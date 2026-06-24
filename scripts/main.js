let panelesSecuencia = [];
let panelActualIndex = 0;
let timeoutActual = null;
let transicionEnProceso = false;
let direccionTransicion = 'adelante'; 

document.addEventListener("DOMContentLoaded", () => {
    inicializarDimensiones();
    inicializarMotorDePaneles();
    iniciarBarba(); 
});

function inicializarDimensiones() {
    // Nos aseguramos de aplicar los tamaños a todas las páginas que existan
    const paginas = document.querySelectorAll('.pagina-comic');
    paginas.forEach(pagina => {
        pagina.style.width = "50vw";
        pagina.style.left = "50vw";
    });
}

// 1. EL MOTOR QUE PREPARA LA PÁGINA
function inicializarMotorDePaneles() {
    // Al usar Barba, a veces hay dos contenedores en pantalla durante un segundo.
    // Siempre tomamos el último, que es la página nueva en la que estamos leyendo.
    const contenedores = document.querySelectorAll('.pagina-comic');
    const contenedor = contenedores[contenedores.length - 1]; 
    if(!contenedor) return;

    panelesSecuencia = Array.from(contenedor.querySelectorAll('.grupo-paneles img'));
    timeoutActual = null;
    panelActualIndex = 0;

    const estadoInicial = contenedor.getAttribute('data-estado-inicial');

    if (estadoInicial === 'final') {
        panelActualIndex = panelesSecuencia.length;
        panelesSecuencia.forEach(img => gsap.set(img, { opacity: 1 }));
        return; 
    }

    let encontroNoAlwaysOn = false;
    panelesSecuencia.forEach((img) => {
        const tipo = img.getAttribute('data-reveal') || 'always-on';
        if (tipo === 'always-on' && !encontroNoAlwaysOn) {
            gsap.set(img, { opacity: 1 });
            panelActualIndex++; 
        } else {
            encontroNoAlwaysOn = true;
            gsap.set(img, { opacity: 0 });
        }
    });

    procesarSiguientePanel();
}

// 2. EL CEREBRO DE LA SECUENCIA
function procesarSiguientePanel() {
    if (panelActualIndex >= panelesSecuencia.length) return; 

    const img = panelesSecuencia[panelActualIndex];
    const tipo = img.getAttribute('data-reveal');

    if (tipo === 'delay') {
        const tiempo = parseInt(img.getAttribute('data-tiempo')) || 500;
        timeoutActual = setTimeout(() => {
            revelarImagen(panelActualIndex);
            panelActualIndex++;
            procesarSiguientePanel(); 
        }, tiempo);
    } else if (tipo === 'click') {
        // Esperamos al evento global de clic
    }
}

function revelarImagen(index) {
    const img = panelesSecuencia[index];
    if(!img) return;
    gsap.to(img, { opacity: 1, duration: 0.5, ease: "power2.out" });
}

function normalizarUrl(url) {
    try {
        return new URL(url, window.location.href).href;
    } catch {
        return url;
    }
}

// 3. EVENTO GLOBAL DE CLIC 
document.addEventListener('click', (evento) => {
    // Si la hoja ya se está moviendo, ignoramos cualquier otro toque
    if (transicionEnProceso) return; 

    const contenedores = document.querySelectorAll('.pagina-comic');
    const contenedor = contenedores[contenedores.length - 1];
    if(!contenedor) return;

    const clickEnIzquierda = evento.clientX < (window.innerWidth * 0.3);

    if (clickEnIzquierda) {
        const prevUrl = contenedor.getAttribute('data-prev');
        if (prevUrl) {
            direccionTransicion = 'atras';
            transicionEnProceso = true; // Bloqueo instantáneo
            barba.go(normalizarUrl(prevUrl));
        }
    } else {
        if (panelActualIndex < panelesSecuencia.length) {
            if (timeoutActual) {
                clearTimeout(timeoutActual);
                timeoutActual = null;
                revelarImagen(panelActualIndex);
                panelActualIndex++;
                procesarSiguientePanel();
            } else {
                const img = panelesSecuencia[panelActualIndex];
                if (img && img.getAttribute('data-reveal') === 'click') {
                    revelarImagen(panelActualIndex);
                    panelActualIndex++;
                    procesarSiguientePanel(); 
                }
            }
        } else {
            const nextUrl = contenedor.getAttribute('data-next');
            if (nextUrl) {
                direccionTransicion = 'adelante';
                transicionEnProceso = true; // Bloqueo instantáneo
                barba.go(normalizarUrl(nextUrl));
            }
        }
    }
});

// 4. EL NUEVO MOTOR DE TRANSICIONES 3D (BARBA + GSAP)
function iniciarBarba() {
    barba.init({
        preventRunning: true,
        sync: true, // Esto obliga a mantener las dos páginas encima para el efecto 3D
        transitions: [{
            name: 'efecto-revista',
            leave(data) {
                return new Promise(resolve => {
                    transicionEnProceso = true;
                    const page = data.current.container;

                    if (!page) {
                        resolve();
                        return;
                    }

                    const tl = gsap.timeline({ onComplete: resolve });

                    if (direccionTransicion === 'adelante') {
                        const sombra = document.createElement('div');
                        sombra.className = 'sombra-pliegue';
                        page.appendChild(sombra);

                        gsap.set(page, { transformOrigin: "bottom left", zIndex: 10 });
                        
                        tl.to(sombra, { opacity: 1, duration: 1.2, ease: "power2.inOut" }, 0)
                          .to(page, {
                            rotationY: -110,
                            rotationZ: -8,
                            xPercent: -10,
                            opacity: 0,
                            duration: 1.2,
                            ease: "power2.inOut"
                        }, 0);
                    } else {
                        gsap.set(page, { zIndex: 1 });
                        tl.to(page, { opacity: 0, duration: 0.8 }, 0);
                    }
                });
            },
            enter(data) {
                return new Promise(resolve => {
                    const page = data.next.container;

                    // ESCUDO PROTECTOR: Si la página nueva no tiene las etiquetas, 
                    // forzamos una recarga segura para no romper la experiencia.
                    if (!page) {
                        window.location.href = data.next.url.href;
                        resolve();
                        return;
                    }

                    const tl = gsap.timeline({ onComplete: resolve });

                    page.style.width = "50vw";
                    page.style.left = "50vw";

                    if (direccionTransicion === 'adelante') {
                        gsap.set(page, { opacity: 0, zIndex: 1 });
                        tl.to(page, { opacity: 1, duration: 1.2, ease: "power2.inOut" }, 0);
                    } else {
                        gsap.set(page, { 
                            transformOrigin: "bottom left", 
                            rotationY: -110, 
                            rotationZ: -8,
                            xPercent: -10,
                            opacity: 0,
                            zIndex: 10 
                        });
                        
                        const sombra = document.createElement('div');
                        sombra.className = 'sombra-pliegue';
                        sombra.style.opacity = 1;
                        page.appendChild(sombra);

                        page.setAttribute('data-estado-inicial', 'final'); 
                        
                        tl.to(sombra, { opacity: 0, duration: 1.2, ease: "power2.inOut" }, 0)
                          .to(page, {
                            rotationY: 0,
                            rotationZ: 0,
                            xPercent: 0,
                            opacity: 1,
                            duration: 1.2,
                            ease: "power2.inOut",
                            onComplete: () => sombra.remove()
                        }, 0);
                    }
                });
            },
            afterEnter() {
                transicionEnProceso = false;
                inicializarMotorDePaneles();
            }
        }]
    });
}