let panelesSecuencia = [];
let panelActualIndex = 0;
let timeoutActual = null;
let transicionEnProceso = false;

document.addEventListener("DOMContentLoaded", () => {
    inicializarDimensiones();
    inicializarMotorDePaneles();
});

function inicializarDimensiones() {
    const pagina = document.querySelector('#contenedor-principal');
    if (pagina) {
        pagina.style.width = "50vw";
        pagina.style.left = "50vw";
    }
}

// 1. EL MOTOR QUE PREPARA LA PÁGINA
function inicializarMotorDePaneles() {
    const contenedor = document.querySelector('#contenedor-principal');
    if(!contenedor) return;

    panelesSecuencia = Array.from(contenedor.querySelectorAll('.grupo-paneles img'));
    timeoutActual = null;
    panelActualIndex = 0;

    const estadoInicial = contenedor.getAttribute('data-estado-inicial');

    // Si el usuario presionó volver atrás, la página aparece con TODO revelado
    if (estadoInicial === 'final') {
        panelActualIndex = panelesSecuencia.length;
        panelesSecuencia.forEach(img => gsap.set(img, { opacity: 1 }));
        return; 
    }

    // Comportamiento normal hacia adelante: Ocultar todo lo que no sea always-on
    let encontroNoAlwaysOn = false;
    panelesSecuencia.forEach((img) => {
        const tipo = img.getAttribute('data-reveal') || 'always-on';
        if (tipo === 'always-on' && !encontroNoAlwaysOn) {
            gsap.set(img, { opacity: 1 });
            panelActualIndex++; // Avanzamos el índice por los que ya están visibles
        } else {
            encontroNoAlwaysOn = true;
            gsap.set(img, { opacity: 0 });
        }
    });

    // Encendemos el motor para procesar el primero que esté oculto
    procesarSiguientePanel();
}

// 2. EL CEREBRO DE LA SECUENCIA
function procesarSiguientePanel() {
    if (panelActualIndex >= panelesSecuencia.length) return; // Ya no hay paneles

    const img = panelesSecuencia[panelActualIndex];
    const tipo = img.getAttribute('data-reveal');

    if (tipo === 'delay') {
        const tiempo = parseInt(img.getAttribute('data-tiempo')) || 500;
        timeoutActual = setTimeout(() => {
            revelarImagen(panelActualIndex);
            panelActualIndex++;
            procesarSiguientePanel(); // Se llama a sí mismo para continuar la cadena
        }, tiempo);
    } else if (tipo === 'click') {
        // Nos detenemos por completo y esperamos al evento de clic global
    }
}

function revelarImagen(index) {
    const img = panelesSecuencia[index];
    if(!img) return;
    gsap.to(img, { opacity: 1, duration: 0.5, ease: "power2.out" });
}

// 3. EVENTO GLOBAL DE CLIC EN LA PANTALLA
document.addEventListener('click', (evento) => {
    if (transicionEnProceso) return; 

    const contenedor = document.querySelector('#contenedor-principal');
    if(!contenedor) return;

    // Detectamos si el clic fue en el lado izquierdo (Retroceder)
    const clickEnIzquierda = evento.clientX < (window.innerWidth * 0.3);

    if (clickEnIzquierda) {
        const prevUrl = contenedor.getAttribute('data-prev');
        if (prevUrl) transicionPagina(prevUrl, 'atras');
    } else {
        // Clic en el resto de la pantalla (Avanzar)
        if (panelActualIndex < panelesSecuencia.length) {
            
            // Si estaba cargando un delay pero el usuario hizo clic, forzamos que aparezca ya
            if (timeoutActual) {
                clearTimeout(timeoutActual);
                timeoutActual = null;
                revelarImagen(panelActualIndex);
                panelActualIndex++;
                procesarSiguientePanel();
            } else {
                // Estaba detenido esperando un clic normal
                const img = panelesSecuencia[panelActualIndex];
                if (img && img.getAttribute('data-reveal') === 'click') {
                    revelarImagen(panelActualIndex);
                    panelActualIndex++;
                    procesarSiguientePanel(); // Desbloqueamos la secuencia
                }
            }
        } else {
            // Ya todos los paneles están revelados. ¡Pasar página!
            const nextUrl = contenedor.getAttribute('data-next');
            if (nextUrl) transicionPagina(nextUrl, 'adelante');
        }
    }
});

// 4. LÓGICA DE PASAR LA HOJA EN 3D
async function transicionPagina(url, direccion) {
    transicionEnProceso = true;
    const escenario = document.querySelector('.escenario-3d');
    const paginaActual = document.querySelector('#contenedor-principal');

    try {
        const respuesta = await fetch(url);
        const htmlTexto = await respuesta.text();

        const parser = new DOMParser();
        const htmlParseado = parser.parseFromString(htmlTexto, 'text/html');
        const nuevaPagina = htmlParseado.querySelector('#contenedor-principal');

        if (!nuevaPagina) { transicionEnProceso = false; return; }

        window.history.pushState({}, '', url);

        nuevaPagina.style.width = "50vw";
        nuevaPagina.style.left = "50vw";

        // Si vamos hacia atrás, le ponemos la etiqueta 'final' para que el motor revele todo de golpe
        if (direccion === 'atras') {
            nuevaPagina.setAttribute('data-estado-inicial', 'final');
            const imagenesNuevas = nuevaPagina.querySelectorAll('.grupo-paneles img');
            imagenesNuevas.forEach(img => gsap.set(img, { opacity: 1 }));
        } else {
            // Si vamos hacia adelante pre-ocultamos lo que no sea always-on para que no parpadee
            const imagenesNuevas = nuevaPagina.querySelectorAll('.grupo-paneles img');
            let encontroNoAlwaysOn = false;
            imagenesNuevas.forEach(img => {
                const tipo = img.getAttribute('data-reveal') || 'always-on';
                if (tipo === 'always-on' && !encontroNoAlwaysOn) {
                    gsap.set(img, { opacity: 1 });
                } else {
                    encontroNoAlwaysOn = true;
                    gsap.set(img, { opacity: 0 });
                }
            });
        }

        escenario.appendChild(nuevaPagina);

        if (direccion === 'adelante') {
            gsap.set(nuevaPagina, { zIndex: 1 });
            gsap.set(paginaActual, { zIndex: 2, transformOrigin: "left center" });

            gsap.to(paginaActual, {
                rotationY: -110, opacity: 0, duration: 1.2, ease: "power2.inOut",
                onComplete: () => { finalizarTransicion(paginaActual, nuevaPagina); }
            });
        } else {
            gsap.set(paginaActual, { zIndex: 1 });
            gsap.set(nuevaPagina, { 
                zIndex: 2, transformOrigin: "left center", rotationY: -110, opacity: 0 
            });

            gsap.to(nuevaPagina, {
                rotationY: 0, opacity: 1, duration: 1.2, ease: "power2.inOut",
                onComplete: () => { finalizarTransicion(paginaActual, nuevaPagina); }
            });
        }
    } catch (error) {
        console.error("Error cargando la página:", error);
        window.location.href = url;
    }
}

function finalizarTransicion(paginaVieja, nuevaPagina) {
    paginaVieja.remove(); 
    nuevaPagina.id = "contenedor-principal";
    transicionEnProceso = false;
    
    // Al terminar el salto 3D, encendemos el motor de paneles de la nueva hoja
    inicializarMotorDePaneles();
}

window.addEventListener('popstate', () => { window.location.reload(); });