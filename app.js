// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[SW] Registrado, scope:', reg.scope))
      .catch((err) => console.error('[SW] Falla de registro:', err));
  });
}

// ---------- Installability ----------
let eventoInstalacionDiferido = null;
const btnInstalar = document.getElementById('btn-instalar');
const avisoIOS = document.getElementById('instrucciones-ios');

function verificarEntornoIOS() {
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const estaInstalada = window.navigator.standalone === true ||
                        window.matchMedia('(display-mode: standalone)').matches;

  // iPhone still in the browser: show manual install instructions
  if (esIOS && !estaInstalada) {
    avisoIOS.hidden = false;
  }
}

// Android / Chrome
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  eventoInstalacionDiferido = event;
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) return;
  eventoInstalacionDiferido.prompt();
  eventoInstalacionDiferido.userChoice.then((resultado) => {
    if (resultado.outcome === 'accepted') {
      btnInstalar.hidden = true;
    }
    eventoInstalacionDiferido = null;
  });
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  avisoIOS.hidden = true;
});

// iOS / Safari: no beforeinstallprompt, show manual instructions
verificarEntornoIOS();
document.getElementById('btn-cerrar-ios').addEventListener('click', () => {
  avisoIOS.hidden = true;
});

// ---------- Camera ----------
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = rear | 'user' = front

const visorVideo = document.getElementById('visor-camara');
const estado = document.getElementById('estado');
const btnAlternar = document.getElementById('btn-alternar-camara');
const btnApagar = document.getElementById('btn-apagar-camara');
const avisoPermiso = document.getElementById('aviso-permiso');

function nombreLente(modo) {
  return modo === 'environment' ? 'Trasera' : 'Frontal';
}

function actualizarMensajeEstado(texto) {
  estado.textContent = texto;
}

function actualizarBotones(activa) {
  btnAlternar.disabled = !activa;
  btnApagar.disabled = !activa;
}

function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

function iniciarCamara(modo) {
  detenerCamaraActiva();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado('Este navegador no soporta acceso a cámara (se requiere HTTPS).');
    return Promise.resolve();
  }

  const restricciones = {
    video: { facingMode: { ideal: modo } },
    audio: false
  };

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      // iOS can require an explicit play() even with autoplay
      return visorVideo.play().catch(() => {});
    })
    .then(() => {
      actualizarMensajeEstado('Cámara activa (' + nombreLente(modo) + ')');
      actualizarBotones(true);
    })
    .catch((error) => {
      detenerCamaraActiva();
      visorVideo.srcObject = null;
      actualizarBotones(false);

      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotReadableError') {
        actualizarMensajeEstado('La cámara está ocupada o bloqueada por el sistema. Apágala e inténtalo de nuevo.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else {
        actualizarMensajeEstado('Error al acceder al hardware: ' + error.message);
      }
    });
}

// Step 1: ethical pre-permission notice (no hardware call yet)
document.getElementById('btn-preparar-camara').addEventListener('click', () => {
  document.getElementById('aviso-lente').textContent = nombreLente(modoCamaraActual).toLowerCase();
  avisoPermiso.hidden = false;
});

// Step 2: explicit consent -> native permission prompt
document.getElementById('btn-confirmar-permiso').addEventListener('click', () => {
  avisoPermiso.hidden = true;
  iniciarCamara(modoCamaraActual);
});

document.getElementById('btn-cancelar-permiso').addEventListener('click', () => {
  avisoPermiso.hidden = true;
  actualizarMensajeEstado('Cámara apagada. No se solicitó ningún permiso.');
});

// Flip lens: stop tracks first (done inside iniciarCamara)
btnAlternar.addEventListener('click', () => {
  modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';
  iniciarCamara(modoCamaraActual);
});

btnApagar.addEventListener('click', () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  actualizarBotones(false);
  actualizarMensajeEstado('Cámara apagada.');
});

// Release the sensor if the page is hidden/closed
window.addEventListener('pagehide', detenerCamaraActiva);
