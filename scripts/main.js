let panelesSecuencia = [];
let panelActualIndex = 0;
let timeoutActual = null;
let transicionEnProceso = false;
let direccionTransicion = 'adelante';
let audioActual = null;
let grupoAudioActual = null; // Referencia al div con data-sfx que está sonando
let ultimoGrupoProcesado = null; // Para detectar cuando salimos de un grupo 
let shakeTweens = new Map();


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

    // Limpiar audio al cambiar de página
    if (audioActual) {
        audioActual.pause();
        audioActual.currentTime = 0;
        audioActual = null;
    }
    grupoAudioActual = null;
    ultimoGrupoProcesado = null;

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
    const indexActual = panelActualIndex;

    if (tipo === 'delay') {
        const tiempo = parseInt(img.getAttribute('data-tiempo')) || 500;
        
        // Buscar audio en img o en su div padre
        let sfxUrl = img.getAttribute('data-sfx');
        let grupoDiv = null;
        
        if (!sfxUrl) {
            grupoDiv = img.closest('[data-sfx]');
            if (grupoDiv) {
                sfxUrl = grupoDiv.getAttribute('data-sfx');
            }
        }
        
        // Verificar si es el primer elemento del grupo de audio
        let esFirstDelGrupo = false;
        if (grupoDiv) {
            const primerImgDelGrupo = grupoDiv.querySelector('img');
            esFirstDelGrupo = (primerImgDelGrupo === img);
        }
        
        // Detectar si es parte de un grupo de revelación rápida
        let grupoRevelacion = img.closest('[data-reveal-group]');
        let esFirstDelGrupoRevelacion = false;
        let tiempoGrupoRevelacion = 0;
        
        if (grupoRevelacion) {
            const primerImgDelGrupoRev = grupoRevelacion.querySelector('img');
            esFirstDelGrupoRevelacion = (primerImgDelGrupoRev === img);
            
            if (esFirstDelGrupoRevelacion) {
                // Calcular tiempo máximo del grupo de revelación
                const imgsDelGrupoRev = grupoRevelacion.querySelectorAll('img[data-reveal="delay"]');
                imgsDelGrupoRev.forEach(imgTemp => {
                    const tiempoImg = parseInt(imgTemp.getAttribute('data-tiempo')) || 0;
                    tiempoGrupoRevelacion = Math.max(tiempoGrupoRevelacion, tiempoImg);
                });
                // Solo agregar un buffer cuando hay varias imágenes en el grupo
                if (imgsDelGrupoRev.length > 1) {
                    tiempoGrupoRevelacion += 100;
                }
            }
        }
        
        // Detectar si estamos saliendo de un grupo de audio anterior
        let tiempoExtraAudio = 0;
        if (ultimoGrupoProcesado && ultimoGrupoProcesado !== grupoDiv) {
            tiempoExtraAudio = parseInt(ultimoGrupoProcesado.getAttribute('data-tiempo-extra-audio')) || 0;
            ultimoGrupoProcesado.removeAttribute('data-tiempo-extra-audio');
        }
        
        // Actualizar referencia del grupo
        ultimoGrupoProcesado = grupoDiv;
        
        // Si hay audio Y es el primer elemento del grupo, reproducir INMEDIATAMENTE
        if (sfxUrl && (esFirstDelGrupo || !grupoDiv)) {
            reproducirAudioPanel(indexActual);
        }
        
        // Revelar la imagen después del delay
        setTimeout(() => {
            revelarImagen(indexActual);
        }, tiempo);
        
        // Si es grupo de revelación, revelar todos los elementos del grupo de forma gradual
        if (esFirstDelGrupoRevelacion) {
            revelarGrupoDeImagenes(grupoRevelacion, tiempo);
        }
        
        // Procesar siguiente panel después de data-tiempo + tiempo extra de audio
        // Si hay grupo de revelación, usar ese tiempo total
        let tiempoEspera = tiempoGrupoRevelacion > 0 ? tiempoGrupoRevelacion : tiempo;
        
        timeoutActual = setTimeout(() => {
            // Si estamos en grupo de revelación, saltar a la siguiente imagen fuera del grupo
            if (grupoRevelacion) {
                const imgsDelGrupoRev = grupoRevelacion.querySelectorAll('img[data-reveal="delay"]');
                let indexUltimoDelGrupo = indexActual;
                for (let i = indexActual; i < panelesSecuencia.length; i++) {
                    if (panelesSecuencia[i].closest('[data-reveal-group]') === grupoRevelacion) {
                        indexUltimoDelGrupo = i;
                    } else {
                        break;
                    }
                }
                panelActualIndex = indexUltimoDelGrupo + 1;
            } else {
                panelActualIndex = indexActual + 1;
            }
            procesarSiguientePanel(); 
        }, tiempoEspera + tiempoExtraAudio);
        
        // Si hay audio en este grupo y es el primer elemento, detectar duración
        if (sfxUrl && esFirstDelGrupo && grupoDiv) {
            const audioTemp = new Audio(sfxUrl);
            let duracionDetectada = false;
            
            const onLoadedMetadata = () => {
                if (!duracionDetectada && audioTemp.duration) {
                    duracionDetectada = true;
                    
                    // Calcular tiempo total del grupo
                    const imgDelGrupo = grupoDiv.querySelectorAll('img[data-reveal="delay"]');
                    let tiempoGrupoTotal = 0;
                    imgDelGrupo.forEach(img => {
                        tiempoGrupoTotal += parseInt(img.getAttribute('data-tiempo')) || 500;
                    });
                    
                    const duracionMs = Math.ceil(audioTemp.duration * 1000) + 100;
                    
                    // Si el audio es más largo que el grupo, almacenar para esperar después
                    if (duracionMs > tiempoGrupoTotal) {
                        const tiempoAdicional = duracionMs - tiempoGrupoTotal;
                        grupoDiv.setAttribute('data-tiempo-extra-audio', tiempoAdicional);
                    }
                    
                    audioTemp.removeEventListener('loadedmetadata', onLoadedMetadata);
                }
            };
            
            audioTemp.addEventListener('loadedmetadata', onLoadedMetadata);
            audioTemp.src = sfxUrl;
        }
    } else if (tipo === 'click') {
        // Esperamos al evento global de clic
        ultimoGrupoProcesado = null;
    }
}

function iniciarTimeout(tiempo) {
    timeoutActual = setTimeout(() => {
        panelActualIndex++;
        procesarSiguientePanel(); 
    }, tiempo);
}

function revelarImagen(index) {
    const img = panelesSecuencia[index];
    if(!img) return;
    gsap.to(img, { opacity: 1, duration: 0.35, ease: "power2.out", force3D: true });

    const grupoRevelacion = img.closest('[data-reveal-group]');
    const effectType = img.getAttribute('data-effect') || grupoRevelacion?.getAttribute('data-effect');
    if (effectType === 'shake') {
        stopShake(img);
        aplicarEfectoShake(img, grupoRevelacion, 0, true);
    }
}

function revelarGrupoDeImagenes(grupoRevelacion, tiempoBase) {
    const imgsDelGrupoRev = Array.from(grupoRevelacion.querySelectorAll('img[data-reveal="delay"]'));
    if (!imgsDelGrupoRev.length) return;

    const tl = gsap.timeline({ delay: tiempoBase / 1000 });
    imgsDelGrupoRev.forEach((imgTemp, idx) => {
        const tiempoImg = parseInt(imgTemp.getAttribute('data-tiempo')) || 0;
        const offset = tiempoImg / 1000;

        tl.to(imgTemp, {
            opacity: 1,
            duration: 0.26,
            ease: "power2.out",
            force3D: true,
            onStart: () => {
                stopShake(imgTemp);
                aplicarEfectoShake(imgTemp, grupoRevelacion, idx, true);
            }
        }, offset);
    });
}

function stopShake(img) {
    const tween = shakeTweens.get(img);
    if (tween) {
        tween.kill();
        shakeTweens.delete(img);
        gsap.set(img, { x: 0, y: 0 });
    }
}

function aplicarEfectoShake(img, grupoRevelacion, idx, continuo = false) {
    let target = img;
    const effectType = grupoRevelacion ? grupoRevelacion.getAttribute('data-effect') : img.getAttribute('data-effect');
    if (effectType !== 'shake') return;

    const strengthStart = parseFloat(grupoRevelacion?.getAttribute('data-effect-strength-start') || img.getAttribute('data-effect-strength-start')) || 0.2;
    const strengthStep = parseFloat(grupoRevelacion?.getAttribute('data-effect-strength-step') || img.getAttribute('data-effect-strength-step')) || 0.05;
    const strength = strengthStart + (idx * strengthStep);
    const intensidad = Math.min(strength, 1);

    const xAmount = Math.round(intensidad * 12);
    const yAmount = Math.round(intensidad * 8);

    if (continuo) {
        stopShake(target);
        const tween = gsap.to(target, {
            x: gsap.utils.random(-xAmount, xAmount),
            y: gsap.utils.random(-yAmount, yAmount),
            duration: 0.1,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            repeatRefresh: true
        });
        shakeTweens.set(target, tween);
    } else {
        stopShake(target);
        gsap.fromTo(target, {
            x: 0,
            y: 0
        }, {
            x: gsap.utils.random(-xAmount, xAmount),
            y: gsap.utils.random(-yAmount, yAmount),
            duration: 0.18,
            repeat: 3,
            yoyo: true,
            ease: 'power2.inOut',
            onComplete: () => gsap.to(target, { x: 0, y: 0, duration: 0.1 })
        });
    }
}

// FUNCIONES DE AUDIO
function reproducirAudioPanel(index) {
    const img = panelesSecuencia[index];
    if(!img) return;
    
    // Buscar audio en la imagen o en su contenedor padre
    let sfxUrl = img.getAttribute('data-sfx');
    let sfxDuration = img.getAttribute('data-sfx-duration');
    let grupoDiv = null;
    
    if (!sfxUrl) {
        grupoDiv = img.closest('[data-sfx]');
        if (grupoDiv) {
            sfxUrl = grupoDiv.getAttribute('data-sfx');
            // Si no hay duración en img, buscar en grupoDiv
            if (!sfxDuration) {
                sfxDuration = grupoDiv.getAttribute('data-sfx-duration');
            }
        }
    }
    
    // Si estamos en el mismo grupo, no reiniciar el audio
    if (grupoDiv && grupoAudioActual === grupoDiv) {
        return;
    }
    
    // Si hay un nuevo audio para esta imagen
    if (sfxUrl) {
        // Detener audio anterior solo si cambió el grupo o es un audio individual
        if (audioActual) {
            audioActual.pause();
            audioActual.currentTime = 0;
        }
        
        audioActual = new Audio(sfxUrl);
        audioActual.volume = 1;
        audioActual.play().catch(err => console.log('Error reproduciendo audio:', err));
        
        // Si hay duración especificada, detener el audio después de ese tiempo
        if (sfxDuration) {
            const duracion = parseInt(sfxDuration);
            setTimeout(() => {
                if (audioActual) {
                    audioActual.pause();
                    audioActual.currentTime = 0;
                }
            }, duracion);
        }
        
        // Actualizar referencia del grupo
        grupoAudioActual = grupoDiv;
    } else {
        // Si no hay audio, limpiar referencias
        if (audioActual && grupoAudioActual !== grupoDiv) {
            audioActual.pause();
            audioActual.currentTime = 0;
            audioActual = null;
        }
        grupoAudioActual = null;
    }
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
                reproducirAudioPanel(panelActualIndex);
                revelarImagen(panelActualIndex);
                panelActualIndex++;
                procesarSiguientePanel();
            } else {
                const img = panelesSecuencia[panelActualIndex];
                if (img && img.getAttribute('data-reveal') === 'click') {
                    reproducirAudioPanel(panelActualIndex);
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