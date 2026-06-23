document.addEventListener("DOMContentLoaded", () => {
    inicializarDimensiones();
    iniciarTransiciones();
});

function inicializarDimensiones() {
    const pagina = document.querySelector('#contenedor-principal');
    if (pagina) {
        pagina.style.width = "50vw";
        pagina.style.left = "50vw";
    }
}

function iniciarTransiciones() {
    const enlaces = document.querySelectorAll('.link-transicion');

    enlaces.forEach(enlace => {
        enlace.addEventListener('click', function(evento) {
            evento.preventDefault(); 
            const urlDestino = this.href;
            if (urlDestino && !urlDestino.includes('#')) {
                transicionPagina(urlDestino);
            }
        });
    });
}

async function transicionPagina(url) {
    const escenario = document.querySelector('.escenario-3d');
    const paginaActual = document.querySelector('#contenedor-principal');

    try {
        const respuesta = await fetch(url);
        const htmlTexto = await respuesta.text();

        const parser = new DOMParser();
        const htmlParseado = parser.parseFromString(htmlTexto, 'text/html');
        const nuevaPagina = htmlParseado.querySelector('#contenedor-principal');

        if (!nuevaPagina) return; 

        // 1. Actualizamos la URL inmediatamente para evitar errores 404 en las imágenes
        window.history.pushState({}, '', url);

        // 2. Posicionamos la nueva página de fondo en el lado derecho
        nuevaPagina.style.width = "50vw";
        nuevaPagina.style.left = "50vw";

        gsap.set(nuevaPagina, { zIndex: 1 });
        escenario.appendChild(nuevaPagina);

        // 3. Fijamos el eje de rotación en el borde izquierdo de la página derecha (centro de la pantalla)
        gsap.set(paginaActual, { zIndex: 2, transformOrigin: "left center" });

        // 4. Animación estilo revista: la hoja se levanta y voltea hacia la izquierda
        gsap.to(paginaActual, {
            rotationY: -110,
            opacity: 0, 
            duration: 1.2, 
            ease: "power2.inOut",
            onComplete: () => {
                paginaActual.remove(); 
                nuevaPagina.id = "contenedor-principal";
                iniciarTransiciones(); // Reinicia listeners para los nuevos botones
            }
        });

    } catch (error) {
        console.error("Error cargando la página:", error);
        window.location.href = url;
    }
}

window.addEventListener('popstate', () => {
    window.location.reload();
});