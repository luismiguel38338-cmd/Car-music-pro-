var bgImg = null;

try {
  localStorage.setItem("pioneerVIP", "1");
  localStorage.setItem("pioneerKIT", "1");
  localStorage.setItem("pioneerCRO", "1");
} catch(e) {}
(function(){
/**
 * Anti-depuración
 * Vacía la página si detecta el depurador abierto.
 */

(function () {
    if (/[?&]debug=1/.test(location.search)) return;   /* modo diagnostico: no vaciar la pagina si hay herramientas abiertas */
    var d = function () {
        var t = Date.now();
        debugger;   /* sin eval: as\u00ed la CSP no necesita 'unsafe-eval' */
        return Date.now() - t > 120;
    };
    setInterval(function () {
        if (d()) {
            try {
                console.clear();
            }
            catch (e) { }
            document.documentElement.innerHTML = '';
        }
    }, 700);
})();

;
/**
 * Configuración
 * PayPal: pon aquí TU enlace de PayPal.me y TU Client ID (ver LEEME.txt, sección "PAYPAL").
 */

window.RD_PAYPAL = "https://www.paypal.me/sebascpm2/5USD";
window.RD_PAYPAL_CLIENT = "BAAePxL92O88foKChLswDaiM0hDipB9gdQ-QPUya098OV9HrnnPbnRen8B2gTEpTYTOaGOvoGqs5GZouik";

/* Pase "Kitipo y Bajos": precio y beta gratis.
   La beta termina en RD_BETA_FIN (hora de República Dominicana, UTC-4). */
window.RD_KIT_PRECIO = 5;
window.RD_BETA_FIN = new Date("2026-10-10T10:30:00-04:00").getTime();

/* Base de datos (Supabase). Rellena estas dos líneas con "Project URL" y la clave "anon / publishable" de tu proyecto.
   Si las dejas vacías, las cuentas se guardan solo en el navegador. */
window.RD_DB_URL = "https://15-204-194-131.sslip.io";
window.RD_DB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InJhZGlvIiwiaWF0IjoxNzkyMjgyODUzLCJleHAiOjIxMDc2NDI4NTN9.MAO1tVAIZaIWHM87wuatkjYLKoa0v7RjeWvPvEu_-ms";

/* Servidor que verifica los pagos de PayPal (carpeta api/ en Vercel). Cambia el dominio si usas otro. */
window.RD_API_PAGO = "https://radio-musicologos.vercel.app/api/pago";

/* Captcha gratis (Cloudflare Turnstile): pega aqu\u00ed la "Site key" (clave p\u00fablica). Vac\u00edo = sin captcha. La clave secreta va en Vercel como TURNSTILE_SECRET. */
window.RD_TURNSTILE_KEY = "0x4AAAAAAFYtu-8JV56-f0JR";

/* Seguridad: estos valores quedan BLOQUEADOS al cargar. Un marcador o la consola ya no pueden cambiarlos
   (por ejemplo alargar la beta gratis o borrar RD_DB_URL para saltarse al servidor). */
["RD_KIT_PRECIO", "RD_BETA_FIN", "RD_DB_URL", "RD_DB_KEY", "RD_API_PAGO", "RD_TURNSTILE_KEY", "RD_PAYPAL", "RD_PAYPAL_CLIENT"].forEach(k => {
    if (k in window) { try { Object.defineProperty(window, k, { value: window[k], writable: false, configurable: false, enumerable: true }); } catch (e) { } }
});

;
/**
 * Reproductor y biblioteca
 * Estado del reproductor, lectura de la carpeta de música, reproducción, pantalla (render/ov) y funciones de los botones.
 */

/*
 * GLOSARIO (nombres cortos de este archivo)
 *   A        el elemento <audio> que reproduce la musica.
 *   on       true si el radio esta encendido.
 *   v / VMAX volumen actual (0..VMAX); VLOUD = ganancia extra de volumen (x2 = +6 dB).
 *   setVol() aplica el volumen (con GainNode; en volumen 0 queda mudo tambien en iPhone).
 *   ov(txt)  muestra un texto corto sobre la pantalla del radio ("MUTE", "VOLUME 20"...).
 *   $(id)    atajo de document.getElementById.
 */

const VELOCIDAD_LETRAS = 45;
const AUD = /\.(mp3|m4a|aac|wav|ogg|opus|flac|weba)$/i;
const A = new Audio();
A.preload = "auto";
const EQS = ["POWERFUL", "NATURAL", "VOCAL", "FLAT", "CUSTOM"];
let lib = [], p = 0, t = 0, on = true, VMAX = 62, v = 24, shuffle = false, eqi = 3, mode = 0, ovT, ovTxt = null, scanning = true, listMode = false, lt = 0, lx = null, lw = null, pending = null, objUrl = null, seq = 0, errs = 0;
const $ = id => document.getElementById(id), up = s => (s || "").toUpperCase(), pad = n => String(n).padStart(2, "0");
const tm = s => isFinite(s) ? pad(Math.floor(s / 60)) + ":" + pad(Math.floor(s % 60)) : "00:00";
/* Volumen: en iPhone/iPad y algunos navegadores, A.volume se ignora (o no afecta lo que pasa por Web Audio), por eso el volumen real se aplica con un GainNode (eqVol) y A.volume solo se usa si no hay Web Audio. VLOUD sube el nivel general (el compresor final evita que sature). */
var eqVol = null;
const VLOUD = 2;
function setVol() {
    const x = Math.max(0, Math.min(1, v / VMAX));
    if (eqVol && typeof AC !== "undefined" && AC) {
        A.volume = 1;
        eqVol.gain.setTargetAtTime(A.muted || v <= 0 ? 0 : x * VLOUD, AC.currentTime, .02);
    }
    else {
        A.volume = x;
        if (v <= 0)
            A.muted = true;
    }
}
setVol();

const idb = (m, k, val) => new Promise(r => {
    try {
        const q = indexedDB.open("pioneer", 1);
        q.onupgradeneeded = () => q.result.createObjectStore("h");
        q.onsuccess = () => {
            const s = q.result.transaction("h", m === "get" ? "readonly" : "readwrite").objectStore("h");
            const x = m === "get" ? s.get(k) : s.put(val, k);
            x.onsuccess = () => r(x.result);
            x.onerror = () => r();
        };
        q.onerror = () => r();
    }
    catch (e) {
        r();
    }
});

function parse(file, folder) {
    let n = file.replace(/\.[^.]+$/, "").replace(/^\s*\d{1,3}\s*[-._)]\s*/, "").trim(), a = folder, ti = n;
    const m = n.split(/\s+[-–]\s+/);
    if (m.length > 1) {
        a = m[0];
        ti = m.slice(1).join(" - ");
    }
    return { title: ti.trim() || n, artist: a };
}

function showWarn() { }

function setLib(raw) {
    lib = raw.map(f => ({ name: f.name, tracks: f.raw.map(r => ({ ...parse(r.file, f.name), file: r.file, url: r.url, fh: r.fh })).sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true })) }))
        .filter(f => f.tracks.length).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    p = 0;
    t = 0;
    lt = 0;
    listMode = false;
    scanning = false;
    showWarn();
    if (lib.length)
        ov(up(lib[0].name));
    else
        ov("SIN MUSICA");
}

async function scanServer() {
    try {
        const base = location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
        const ls = async (u) => {
            const r = await fetch(u);
            if (!r.ok)
                throw 0;
            const d = new DOMParser().parseFromString(await r.text(), "text/html");
            return [...d.querySelectorAll("a")].map(a => a.getAttribute("href")).filter(h => h && !/^([?#\/.]|[a-z]+:)/i.test(h));
        };
        const top = await ls(base), raw = [];
        const here = decodeURIComponent(location.pathname.replace(/\/[^\/]*$/, "").split("/").pop()) || "MUSICA";
        const rf = top.filter(h => !h.endsWith("/") && AUD.test(decodeURIComponent(h))).map(h => ({ file: decodeURIComponent(h), url: base + h }));
        if (rf.length)
            raw.push({ name: here, raw: rf });
        for (const h of top.filter(h => h.endsWith("/"))) {
            const fs = (await ls(base + h)).filter(f => !f.endsWith("/") && AUD.test(decodeURIComponent(f))).map(f => ({ file: decodeURIComponent(f), url: base + h + f }));
            if (fs.length)
                raw.push({ name: decodeURIComponent(h.slice(0, -1)), raw: fs });
        }
        return raw.length ? raw : null;
    }
    catch (e) {
        return null;
    }
}

async function scanHandle(dir) {
    const raw = [], root = [];
    for await (const [n, h] of dir.entries()) {
        if (h.kind === "directory" && !n.startsWith(".")) {
            const fs = [];
            for await (const [fn, fh] of h.entries()) {
                if (fh.kind === "file" && AUD.test(fn))
                    fs.push({ file: fn, fh });
            }
            if (fs.length)
                raw.push({ name: n, raw: fs });
        }
        else if (h.kind === "file" && AUD.test(n))
            root.push({ file: n, fh: h });
    }
    if (root.length)
        raw.unshift({ name: dir.name, raw: root });
    return raw;
}

async function useHandle(h) {
    scanning = true;
    render();
    try {
        setLib(await scanHandle(h));
    }
    catch (e) {
        scanning = false;
        ov("SIN ACCESO");
        render();
    }
}

function pickFolderInput() {
    return new Promise(res => {
        const i = document.createElement("input");
        i.type = "file";
        i.multiple = true;
        i.accept = "audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.weba";
        i.setAttribute("webkitdirectory", "");
        i.setAttribute("directory", "");
        i.style.display = "none";
        i.addEventListener("change", () => { const f = [...i.files]; i.remove(); res(f); });
        i.addEventListener("cancel", () => { i.remove(); res([]); });
        document.body.appendChild(i);
        i.click();
    });
}

function rawFromFiles(files) {
    const g = {};
    files.filter(f => AUD.test(f.name)).forEach(f => {
        const ps = (f.webkitRelativePath || f.name).split("/");
        const name = ps.length >= 3 ? ps[1] : ps.length === 2 ? ps[0] : "MUSICA";
        (g[name] = g[name] || []).push({ file: f.name, fh: { getFile: async () => f } });
    });
    return Object.keys(g).map(n => ({ name: n, raw: g[n] }));
}

async function pickFolder() {
    if (!window.showDirectoryPicker) {
        /* Firefox, Safari y otros: selector de carpeta clásico (hay que volver a elegirla en cada visita) */
        const fs = await pickFolderInput();
        if (!fs.length)
            return;
        scanning = true;
        render();
        setLib(rawFromFiles(fs));
        return;
    }
    try {
        const h = await showDirectoryPicker({ mode: "read" });
        idb("put", "dir", h);
        pending = null;
        await useHandle(h);
    }
    catch (e) { }
}

async function connect() {
    if (pending) {
        const h = pending;
        pending = null;
        try {
            if ((await h.requestPermission({ mode: "read" })) === "granted") {
                await useHandle(h);
                return;
            }
        }
        catch (e) { }
    }
    await pickFolder();
}

async function init() {
    scanning = true;
    render();
    if (location.protocol.startsWith("http")) {
        const r = await scanServer();
        if (r) {
            setLib(r);
            return;
        }
    }
    const h = await idb("get", "dir");
    if (h) {
        try {
            if ((await h.queryPermission({ mode: "read" })) === "granted") {
                await useHandle(h);
                return;
            }
        }
        catch (e) { }
        pending = h;
    }
    scanning = false;
    lib = [];
    showWarn();
    render();
}

async function playTrack() {
    if (!lib.length)
        return;
    const my = ++seq, tr = lib[p].tracks[t];
    let src = tr.url;
    if (tr.fh) {
        try {
            const f = await tr.fh.getFile();
            if (my !== seq)
                return;
            if (objUrl)
                URL.revokeObjectURL(objUrl);
            objUrl = URL.createObjectURL(f);
            src = objUrl;
        }
        catch (e) {
            ov("SKIP");
            return;
        }
    }
    initAudio();
    A.src = src;
    setVol();
    try {
        await A.play();
    }
    catch (e) { }
    render();
}

A.onended = () => {
    errs = 0;
    next();
};

A.onplaying = () => {
    errs = 0;
    initAudio();
    render();
};

A.onerror = () => {
    if (!lib.length || !A.getAttribute("src"))
        return;
    if (++errs > 6) {
        ov("ERROR");
        return;
    }
    ov("SKIP");
    setTimeout(next, 700);
};

function next() {
    if (!lib.length || !on)
        return;
    const n = lib[p].tracks.length;
    if (shuffle && n > 1) {
        let r;
        do {
            r = Math.floor(Math.random() * n);
        } while (r === t);
        t = r;
    }
    else
        t = (t + 1) % n;
    playTrack();
}

function prev() {
    if (!lib.length || !on)
        return;
    if (A.currentTime > 3) {
        A.currentTime = 0;
        return;
    }
    t = (t - 1 + lib[p].tracks.length) % lib[p].tracks.length;
    playTrack();
}

function restart() {
    if (lib.length && on)
        A.currentTime = 0;
}

function toggle() {
    if (!on)
        return;
    if (!lib.length) {
        connect();
        return;
    }
    if (!A.getAttribute("src")) {
        playTrack();
        ov("PLAY");
        return;
    }
    if (A.paused) {
        A.play();
        ov("PLAY");
    }
    else {
        A.pause();
        ov("PAUSE");
    }
}

function chPl(d) {
    if (!on || !lib.length)
        return;
    if (lib.length < 2) {
        ov("FOLDER 01/01");
        return;
    }
    p = (p + d + lib.length) % lib.length;
    t = 0;
    lt = 0;
    listMode = false;
    shuffle = false;
    playTrack();
    ov(pad(p + 1) + "/" + pad(lib.length) + " " + up(lib[p].name));
}

function vol(d) {
    if (!on)
        return;
    if (listMode) {
        browse(d);
        return;
    }
    v = Math.max(0, Math.min(VMAX, v + d));
    A.muted = false;
    setVol();
    ov(v <= 0 ? "VOLUME 0" : "VOLUME " + v);
}

function mute() {
    if (!on)
        return;
    A.muted = !A.muted;
    setVol();
    ov(A.muted ? "MUTE ON" : "VOLUME " + v);
}

function shuf() {
    if (!on)
        return;
    shuffle = !shuffle;
    ov("MIX " + (shuffle ? "ON" : "OFF"));
}

function eq() {
    if (!on)
        return;
    eqi = (eqi + 1) % EQS.length;
    ov(streamMode ? "EQ" : "EQ " + EQS[eqi]);
    applyPreset();
}

function band() {
    if (on)
        ov("USB");
}

let rdAcceso = () => false;   /* lo reemplaza cuenta.js: true solo con sesi\u00f3n verificada */
function power() {
    if (!on && !rdAcceso())
        return;
    on = !on;
    if (!on)
        A.pause();
    else if (A.getAttribute("src"))
        A.play();
    render();
}

function dmode() {
    if (!on)
        return;
    mode = 1 - mode;
    render();
}

function eject() {
    if (on)
        pickFolder();
}

function phone() {
    if (on)
        ov("NO PHONE");
}

function listN() {
    if (!on || !lib.length)
        return;
    listMode = !listMode;
    lt = t;
    ovTxt = null;
    clearTimeout(lx);
    clearTimeout(lw);
    if (listMode)
        lx = setTimeout(() => {
            listMode = false;
            render();
        }, 5000);
    render();
}

function browse(d) {
    if (!lib.length)
        return;
    const n = lib[p].tracks.length;
    lt = (lt + d + n) % n;
    ovTxt = null;
    clearTimeout(lx);
    lx = setTimeout(() => {
        listMode = false;
        render();
    }, 5000);
    clearTimeout(lw);
    lw = setTimeout(confirmList, 700);
    render();
}

function confirmList() {
    clearTimeout(lw);
    if (!listMode || !lib.length)
        return;
    t = lt;
    playTrack();
    clearTimeout(lx);
    lx = setTimeout(() => {
        listMode = false;
        render();
    }, 5000);
}

function render() {
    const has = lib.length > 0, tr = has ? lib[p].tracks[listMode ? lt : t] : null;
    document.querySelectorAll(".ledg").forEach(x => x.classList.toggle("lit", on));
    $("face").classList.toggle("poff", !on);
    $("eqs").classList.toggle("poff", !on);
    $("atqs").classList.toggle("poff", !on);
    $("vms").classList.toggle("off", !on);
    $("offl").style.display = on ? "none" : "block";
    $("dsp").style.display = on ? "block" : "none";
    $("t1").textContent = listMode ? "LIST" : "USB";
    $("t2").textContent = has ? "📁 " + up(lib[p].name) : "";
    $("art").textContent = tr ? "👤 " + up(tr.artist) : "";
    $("ic").style.opacity = (!A.paused && A.getAttribute("src")) ? 1 : .5;
    let big;
    if (ovTxt !== null)
        big = ovTxt;
    else if (scanning)
        big = "BUSCANDO...";
    else if (listMode && has)
        big = pad(lt + 1) + "/" + pad(lib[p].tracks.length) + " " + up(tr.title);
    else if (!has)
        big = "ELEGIR CARPETA";
    else if (mode)
        big = tm(A.currentTime) + " / " + tm(A.duration);
    else
        big = up(tr.title);
    const e = $("t3s");
    if (e.textContent !== big) {
        e.textContent = big;
        e.className = big.length > 15 ? "sc" : "";
        e.style.animationDuration = e.className ? Math.max(6, e.offsetWidth / VELOCIDAD_LETRAS) + "s" : "";
    }
    const dg = -135 + v / VMAX * 270;
    $("kln").style.transform = "rotate(" + dg + "deg)";
}

/* Mientras se gira el volumen llegan muchos pasos seguidos: la perilla gira al instante y la pantalla se dibuja una sola vez por cuadro (antes se redibujaba todo en cada paso). */
let ovRaf = 0;
function ov(x) {
    ovTxt = x;
    const dg = -135 + v / VMAX * 270;
    $("kln").style.transform = "rotate(" + dg + "deg)";
    if (!ovRaf)
        ovRaf = requestAnimationFrame(() => { ovRaf = 0; render(); });
    clearTimeout(ovT);
    ovT = setTimeout(() => {
        ovTxt = null;
        render();
    }, 1500);
}

setInterval(render, 500);

;
/**
 * Controles de usuario
 * Perilla de volumen (arrastre/rueda), gestos en la pantalla, botones +/- y atajos de teclado.
 */

(() => {
    const k = $("kb");
    let a0, acc = 0, moved = false, sx = 0, sy = 0, id = null;
    const ang = e => {
        const r = k.getBoundingClientRect();
        return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };
    k.addEventListener("pointerdown", e => {
        id = e.pointerId;
        try {
            k.setPointerCapture(id);
        }
        catch (x) { }
        a0 = ang(e);
        acc = 0;
        moved = false;
        sx = e.clientX;
        sy = e.clientY;
    });
    k.addEventListener("pointermove", e => {
        if (id !== e.pointerId)
            return;
        if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8)
            moved = true;
        if (!moved)
            return;
        const a = ang(e);
        let d = a - a0;
        if (d > 180)
            d -= 360;
        if (d < -180)
            d += 360;
        a0 = a;
        acc += d;
        while (acc >= 12) {
            vol(1);
            acc -= 12;
        }
        while (acc <= -12) {
            vol(-1);
            acc += 12;
        }
    });
    k.addEventListener("pointerup", e => {
        if (id !== e.pointerId)
            return;
        id = null;
        if (moved)
            return;
        const r = k.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        if (Math.hypot(dx, dy) < .4) {
            if (listMode)
                confirmList();
            else
                nextColor();
            return;
        }
        vol(dx < 0 ? -1 : 1);
    });
    k.addEventListener("pointercancel", () => {
        id = null;
    });
})();

(() => {
    const d = $("dsp");
    let sx = 0, sy = 0;
    d.addEventListener("pointerdown", e => {
        sx = e.clientX;
        sy = e.clientY;
    });
    d.addEventListener("pointerup", e => {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            dx < 0 ? next() : prev();
        }
        else if (Math.hypot(dx, dy) < 10) {
            toggle();
        }
    });
})();

document.querySelectorAll("#tb [data-v]").forEach(b => {
    let t1, t2;
    const d = +b.dataset.v, stop = () => {
        clearTimeout(t1);
        clearInterval(t2);
    };
    b.addEventListener("pointerdown", () => {
        vol(d);
        t1 = setTimeout(() => {
            t2 = setInterval(() => vol(d), 110);
        }, 400);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, stop));
});

/* Rueda: cada "clic" del ratón (100) = 2 pasos y los trackpads (deltas pequeños) se acumulan, asi responde rapido y sin saltos */
let wAcc = 0;
$("kb") && $("kb").addEventListener("wheel", e => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    wAcc += dy;
    const n = Math.trunc(Math.abs(wAcc) / 50);
    if (!n) return;
    const d = wAcc < 0 ? 1 : -1;
    wAcc -= (wAcc < 0 ? -1 : 1) * n * 50;
    for (let i = 0; i < Math.min(n, 12); i++) vol(d);
}, { passive: false });

addEventListener("keydown", e => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;   /* escribiendo (chat, buscador...): los atajos de la radio no se activan */
    const k = e.key;
    if (k === "ArrowRight")
        next();
    else if (k === "ArrowLeft")
        prev();
    else if (k === "ArrowUp") {
        e.preventDefault();
        vol(1);
    }
    else if (k === "ArrowDown") {
        e.preventDefault();
        vol(-1);
    }
    else if (k === " ") {
        e.preventDefault();
        toggle();
    }
    else if (k === "PageUp")
        chPl(-1);
    else if (k === "PageDown")
        chPl(1);
});

;
/**
 * Audio y ecualizadores
 * Web Audio (filtros, compresor, analizador), perillas del ecualizador, presets y guardado.
 */

/*
 * GLOSARIO (nombres cortos de este archivo)
 *   AC       AudioContext: el motor de audio del navegador.
 *   eqSrc    fuente: el <audio> conectado al motor.
 *   eqVol    ganancia del volumen general (ver setVol en player.js).
 *   eqPre    retardo previo (hoy 0).
 *   units    lista de ecualizadores normales (maximo MAXEQ); cada uno: { vals, byp, nodes, k[] }.
 *   u.byp    "bypass": true = ese EQ esta apagado.
 *   u.vals   valores de las perillas (vol, sub, fader, loud, b0..b6 = bandas).
 *   eqBus    mezcla de todos los EQ y Ateq (su ganancia se reparte entre los encendidos, busGain()).
 *   eqCp     compresor final de seguridad antes de la salida.
 * Cadena de audio: audio -> eqVol -> eqPre -> EQs/Ateq -> eqBus -> [crossover o procesador] -> eqCp -> salida.
 */

const BANDS = [["50Hz", 50], ["125Hz", 125], ["316Hz", 316], ["750Hz", 750], ["2.2KHz", 2200], ["6KHz", 6000], ["16KHz", 16000]];
const sgn = x => (x > 0 ? "+" : "") + (+x.toFixed(1)) + "dB";

const KDEF = [
    { id: "sub", lab: "SUB LEVEL", big: 1, d: 9.65, min: -12, max: 12, def: 0, st: .5, bi: 1, f: x => (x > 0 ? "+" : "") + Math.round(x / 12 * 100) + "%" },
    { id: "vol", lab: "VOLUME", big: 1, d: 9.55, min: 0, max: 1, def: 2 / 3, st: .01, f: x => Math.round(x * 150) + "%" },
    { id: "fader", lab: "FADER", d: 7.3, min: -12, max: 12, def: 0, st: .5, bi: 1, f: x => x === 0 ? "CENTRO" : (x > 0 ? "F" : "R") + Math.round(Math.abs(x) / 12 * 100) + "%" }
].concat(BANDS.map((b, i) => ({ id: "b" + i, lab: b[0], d: 7.25, min: -12, max: 12, def: 0, st: .5, bi: 1, f: sgn })));

/* Modo streaming: oculta tus niveles de EQ (valores, posici\u00f3n de las perillas, bypass y textos del display). */
let streamMode = false;

try {
    streamMode = localStorage.getItem("pioneerStream") === "1";
}
catch (e) { }

function setStream(v, save) {
    streamMode = !!v;
    document.body.classList.toggle("stream", streamMode);
    units.forEach(u => u.k.forEach(k => { if (k.el) paintK(u, k); }));
    const b = document.getElementById("strb");
    if (b) {
        b.classList.toggle("on", streamMode);
        b.setAttribute("aria-pressed", String(streamMode));
        b.textContent = streamMode ? "\uD83D\uDD34 Modo streaming: ENCENDIDO" : "\u26AA Modo streaming: APAGADO";
    }
    if (save) {
        try {
            localStorage.setItem("pioneerStream", streamMode ? "1" : "0");
        }
        catch (e) { }
    }
}

const EQIDS = ["sub", "loud"].concat(BANDS.map((b, i) => "b" + i));
const MAXEQ = 5, units = [];
let AC = null, eqPre = null, eqSrc = null, eqCp = null, eqBus = null, eqNodes = null, audioFail = false, eqQ = 1.2, EQX = 1, VG = 1;
const PRE = [[.5, 5, [6, 5, 2, 0, 1, 3, 4]], [0, 0, [2, 1, 0, 0, 0, 1, 2]], [0, 0, [-3, -2, 0, 3, 4, 2, 0]], [0, 0, [0, 0, 0, 0, 0, 0, 0]]];

function eqSave() {
    try {
        localStorage.setItem("pioneerEQ3", JSON.stringify({ i: eqi, n: units.map(u => ({ v: u.vals, b: u.byp, c: u.custom })) }));
    }
    catch (e) { }
}

function eqLoad() {
    try {
        const s = JSON.parse(localStorage.getItem("pioneerEQ3"));
        return s && Array.isArray(s.n) && s.n.length ? s : null;
    }
    catch (e) {
        return null;
    }
}

function mkNodes(c) {
    const mk = (type, f, q) => {
        const b = c.createBiquadFilter();
        b.type = type;
        b.frequency.value = f;
        if (q)
            b.Q.value = q;
        return b;
    };
    const ld = mk("lowshelf", 120), lh = mk("highshelf", 8000), fd = mk("highshelf", 3500), sb = mk("lowshelf", 100), sbc = mk("lowshelf", 250), hp1 = mk("highpass", 15, .707), hp2 = mk("highpass", 15, .707);
    const bands = BANDS.map(b => mk("peaking", b[1], eqQ)), mg = c.createGain();
    [ld, lh, sb, sbc, hp1, hp2, fd, ...bands, mg].reduce((x, y) => (x.connect(y), y));
    return { in: ld, out: mg, ld, lh, sb, sbc, hp1, hp2, fd, bands, mg };
}

function wire() {
    if (!AC)
        return;
    try {
        eqSrc.disconnect();
    }
    catch (e) { }
    try {
        eqPre.disconnect();
    }
    catch (e) { }
    try {
        eqVol.disconnect();
    }
    catch (e) { }
    eqSrc.connect(eqVol);
    eqVol.connect(eqPre);
    setVol();
    units.forEach(u => {
        try {
            u.nodes.out.disconnect();
        }
        catch (e) { }
    });
    units.forEach(u => {
        eqPre.connect(u.nodes.in);
        u.nodes.out.connect(eqBus);
    });
    if (typeof ateqWire === "function")
        ateqWire();
    if (typeof croWire === "function")
        croWire();
    busGain();
}

function initAudio() {
    if (AC) {
        if (AC.state === "suspended")
            AC.resume();
        return;
    }
    if (audioFail)
        return;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) {
            audioFail = true;
            return;
        }
        const c = new Ctx();
        const cp = c.createDynamicsCompressor(), an = c.createAnalyser(), av = c.createAnalyser();
        an.fftSize = 2048;
        an.smoothingTimeConstant = .6;
        av.fftSize = 2048;
        av.smoothingTimeConstant = .5;
        av.minDecibels = -85;
        av.maxDecibels = -5;
        cp.threshold.value = -4;
        cp.knee.value = 6;
        cp.ratio.value = 12;
        cp.attack.value = .003;
        cp.release.value = .2;
        const ns = units.map(() => mkNodes(c));
        const s = c.createMediaElementSource(A);
        units.forEach((u, j) => u.nodes = ns[j]);
        const bus = c.createGain();
        bus.connect(cp);
        bus.connect(av);
        cp.connect(an);
        cp.connect(c.destination);
        AC = c;
        c.onstatechange = () => { if (c.state === "suspended" || c.state === "interrupted") setTimeout(() => { try { if (!document.hidden && c.state !== "running") c.resume(); } catch (e) { } }, 300); };
        eqSrc = s;
        eqPre = c.createDelay(.05);
        eqPre.delayTime.value = 0;
        eqVol = c.createGain();
        eqVol.gain.value = 0;
        eqCp = cp;
        eqBus = bus;
        eqNodes = { an, av };
        wire();
        applyAudio();
    }
    catch (e) {
        audioFail = true;
    }
    if (AC && AC.state === "suspended")
        AC.resume();
}

function applyUnit(u) {
    const n = u.nodes;
    if (!n)
        return;
    const tt = AC.currentTime, s = (p, x) => p.setTargetAtTime(x, tt, .03), z = u.byp, V = u.vals;
    s(n.ld.gain, z ? 0 : V.loud * 8);
    s(n.lh.gain, z ? 0 : V.loud * 5);
    s(n.fd.gain, z ? 0 : (V.fader < 0 ? V.fader * .9 : V.fader * .25));
    const sv = z ? 0 : Math.min(12, V.sub + BASSX), hf = 15 * Math.pow(160 / 15, Math.max(-sv, 0) / 12);
    s(n.sb.gain, Math.max(sv, 0) * 1.25);
    s(n.sbc.gain, Math.min(sv, 0) * 3.8);
    s(n.hp1.frequency, hf);
    s(n.hp2.frequency, hf);
    /* Bajar una banda al maximo la corta de verdad (hasta -40 dB), no solo la atenua */
    n.bands.forEach((b, i) => s(b.gain, z ? 0 : (V["b" + i] < 0 ? V["b" + i] * 3.33 : V["b" + i])));
    s(n.mg.gain, z ? 0 : V.vol * 1.5 * EQX * VG);   /* EQ apagado = no suena */
    busGain();
}

/* El volumen total se reparte solo entre los EQ encendidos */
function busGain() {
    if (!AC || !eqBus)
        return;
    const act = units.filter(u => !u.byp).length + (typeof ateqCount === "function" ? ateqCount() : 0);
    eqBus.gain.setTargetAtTime(1 / Math.max(1, act), AC.currentTime, .03);
    /* El Procesador usa compresores de Web Audio, que retrasan ~6 ms cada uno: los demas equipos se retrasan igual para que no suenen con eco al sumarse */
    if (eqPre)
        eqPre.delayTime.setTargetAtTime(typeof croLat === "function" ? croLat() : 0, AC.currentTime, .03);
}

function applyAudio() {
    units.forEach(applyUnit);
    if (typeof ateqApply === "function")
        ateqApply();
    if (typeof croApply === "function")
        croApply();
}

function paintK(u, k) {
    if (!k.el)
        return;
    const x = u.vals[k.id], n = (x - k.min) / (k.max - k.min), pos = n * 270;
    const s = k.bi ? Math.min(135, pos) : 0, e = k.bi ? Math.max(135, pos) : pos;
    k.rg.style.setProperty("--s", s + "deg");
    k.rg.style.setProperty("--e", e + "deg");
    k.cp.style.transform = "rotate(" + (pos - 135) + "deg)";
    k.rd.textContent = k.f(x);
    if (streamMode)
        k.el.removeAttribute("aria-valuenow");
    else
        k.el.setAttribute("aria-valuenow", Math.round(n * 100));
}

function setK(u, k, x, user) {
    x = Math.min(k.max, Math.max(k.min, Math.round(x / k.st) * k.st));
    const V = u.vals;
    if (x === V[k.id])
        return;
    V[k.id] = x;
    paintK(u, k);
    applyUnit(u);
    if (user) {
        if (u.i === 0 && k.id !== "vol" && k.id !== "fader") {
            eqi = 4;
            EQIDS.forEach(i => u.custom[i] = V[i]);
        }
        eqSave();
        if (on && !streamMode)
            ov((u.i ? "EQ" + (u.i + 1) + " " : "") + up(k.lab) + " " + k.f(x));
    }
}

function applyPreset() {
    const u = units[0], V = u.vals;
    if (eqi === 4)
        EQIDS.forEach(i => V[i] = u.custom[i]);
    else {
        const q = PRE[eqi];
        V.loud = q[0];
        V.sub = q[1];
        q[2].forEach((x, i) => V["b" + i] = x);
    }
    u.k.forEach(k => paintK(u, k));
    applyUnit(u);
    eqSave();
}

function mkKnob(d) {
    const el = document.createElement("div");
    el.className = "kn2";
    el.style.width = d + "cqw";
    el.innerHTML = '<div class="kglow"><div class="kring"></div></div><div class="kbody"></div><div class="kcap"><i></i></div>';
    return el;
}

const wst = k => (k.max - k.min) / (k.bi ? 24 : 20);

function bindK(u, k) {
    const el = k.el, V = u.vals;
    let dr = null, lastTap = 0;
    el.addEventListener("pointerdown", e => {
        dr = { id: e.pointerId, y: e.clientY, v: V[k.id] };
        try {
            el.setPointerCapture(e.pointerId);
        }
        catch (x) { }
        el.focus({ preventScroll: true });
    });
    el.addEventListener("pointermove", e => {
        if (!dr || dr.id !== e.pointerId)
            return;
        if (Math.abs(dr.y - e.clientY) > 4)
            dr.mv = true;
        setK(u, k, dr.v + (dr.y - e.clientY) / 150 * (k.max - k.min), true);
    });
    const end = e => {
        if (dr && dr.id === e.pointerId) {
            if (e.type === "pointerup" && e.pointerType === "touch" && !dr.mv) {
                const n = Date.now();
                if (n - lastTap < 350) {
                    setK(u, k, k.def, true);
                    lastTap = 0;
                }
                else
                    lastTap = n;
            }
            dr = null;
        }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("wheel", e => {
        e.preventDefault();
        setK(u, k, V[k.id] + (e.deltaY < 0 ? 1 : -1) * wst(k), true);
    }, { passive: false });
    el.addEventListener("dblclick", () => setK(u, k, k.def, true));
    el.addEventListener("keydown", e => {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (d) {
            e.preventDefault();
            e.stopPropagation();
            setK(u, k, V[k.id] + d * wst(k), true);
        }
    });
}

const XS = [6.39, 17.6, 26.59, 33.47, 40.61, 48.49, 56.23, 63.9, 71.62, 79.45, 87.29, 95.03];

function buildUnit(u) {
    const w = document.createElement("div");
    w.className = "eqw";
    w.innerHTML = '<div class="eqp"><div class="eqplate"><div class="eqbody"></div></div></div>';
    $("eqs").appendChild(w);
    u.el = w;
    const body = w.querySelector(".eqbody");
    let ix = 0;
    const cell = (lab, node, d, fs, g) => {
        const c = document.createElement("div");
        c.className = "kc";
        c.style.left = XS[ix++] + "cqw";
        c.style.setProperty("--d", d + "cqw");
        c.style.setProperty("--fs", fs + "cqw");
        c.style.setProperty("--g", g + "cqw");
        const l = document.createElement("div");
        l.className = "kl";
        l.textContent = lab || "";
        const r = document.createElement("div");
        r.className = "kv";
        c.append(l, node, r);
        body.appendChild(c);
        return r;
    };
    const addK = k => {
        const el = mkKnob(k.d);
        el.tabIndex = 0;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-label", k.lab);
        k.el = el;
        k.rg = el.querySelector(".kring");
        k.cp = el.querySelector(".kcap");
        k.rd = cell(k.lab, el, k.d, k.big ? 2 : 1.7, k.big ? .15 : .75);
        bindK(u, k);
    };
    u.k.slice(0, 2).forEach(addK);
    const sw = mkKnob(5.9);
    sw.style.cursor = "pointer";
    sw.tabIndex = 0;
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-label", "AUX S/W (EQ ON/OFF)");
    const swr = cell("AUX S/W", sw, 5.9, 1.8, .65);
    const paintSw = () => {
        sw.classList.toggle("byp", !!u.byp);
        sw.querySelector(".kcap").style.transform = "rotate(" + (u.byp ? -90 : 0) + "deg)";
        swr.textContent = u.byp ? "APAGADO" : "ACTIVO";
        sw.setAttribute("aria-checked", String(!u.byp));
    };
    const tog = () => {
        u.byp = !u.byp;
        paintSw();
        applyUnit(u);
        eqSave();
        if (on && !streamMode)
            ov("EQ" + (u.i + 1) + " " + (u.byp ? "OFF" : "ON"));
    };
    sw.addEventListener("click", tog);
    sw.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            tog();
        }
    });
    const jk = document.createElement("div");
    jk.className = "jack";
    cell("AUX IN", jk, 4.7, 1.4, .55);
    u.k.slice(2).forEach(addK);
    u.k.forEach(k => paintK(u, k));
    paintSw();
}

function mkUnit(saved) {
    const u = { i: units.length, vals: {}, custom: {}, byp: false, k: KDEF.map(d => Object.assign({}, d)), nodes: null };
    u.k.forEach(k => u.vals[k.id] = k.def);
    u.vals.loud = 0;
    EQIDS.forEach(i => u.custom[i] = 0);
    if (saved) {
        u.k.forEach(k => {
            const x = saved.v && saved.v[k.id];
            if (typeof x === "number")
                u.vals[k.id] = Math.min(k.max, Math.max(k.min, x));
        });
        EQIDS.forEach(i => {
            const x = saved.c && saved.c[i];
            if (typeof x === "number")
                u.custom[i] = x;
        });
        u.byp = !!saved.b;
    }
    units.push(u);
    buildUnit(u);
    if (AC) {
        u.nodes = mkNodes(AC);
        applyUnit(u);
        wire();
    }
    return u;
}

function eqCtl() {
    $("eqn").textContent = units.length + "/" + MAXEQ;
    $("eqa").disabled = units.length >= MAXEQ;
    $("eqm").disabled = units.length <= 1;
}

function addEQ() {
    if (units.length >= MAXEQ)
        return;
    mkUnit(null);
    setColor(ci, false);
    eqSave();
    eqCtl();
    applyOrder();
    if (on)
        ov("EQ " + units.length + " ADDED");
}

function rmEQ() {
    if (units.length <= 1)
        return;
    const u = units.pop();
    if (u.nodes) {
        try {
            u.nodes.out.disconnect();
        }
        catch (e) { }
    }
    u.el.remove();
    wire();
    eqSave();
    eqCtl();
    applyOrder();
    if (on)
        ov("EQ " + (units.length + 1) + " REMOVED");
}

{
    const sv = eqLoad();
    if (sv && Number.isInteger(sv.i) && sv.i >= 0 && sv.i < EQS.length)
        eqi = sv.i;
    (sv ? sv.n.slice(0, MAXEQ) : [null]).forEach(x => mkUnit(x));
    applyPreset();
    eqCtl();
    $("eqa") && $("eqa").addEventListener("click", addEQ);
    $("eqm") && $("eqm").addEventListener("click", rmEQ);
    setStream(streamMode, false);
    $("strb") && $("strb").addEventListener("click", () => setStream(!streamMode, true));
}

addEventListener("pointerdown", initAudio, { once: true });
addEventListener("keydown", initAudio, { once: true });

/* Celulares: el audio queda "suspendido" (o "interrupted" en iPhone) hasta un toque del usuario, tras una llamada, al bloquear
   la pantalla o al volver de otra app. Se despierta con cualquier toque, al volver a la pesta\u00f1a y cuando el propio sistema lo pausa. */
function despertarAudio() {
    try {
        if (!AC) { initAudio(); return; }
        if (AC.state !== "running" && AC.state !== "closed")
            AC.resume();
    }
    catch (e) { }
}
["touchend", "click", "pointerup"].forEach(ev => addEventListener(ev, despertarAudio, { capture: true, passive: true }));
document.addEventListener("visibilitychange", () => { if (!document.hidden) despertarAudio(); });

;
/**
 * Otros EQs: Pre Ateq (tipo Autotek). M\u00e1ximo 2.
 * Perillas VOL, SUB, FADER, SUB BASS, MID BASS, MID, TREBLE y un bot\u00f3n LED (azul o rojo) propio de cada uno,
 * que no depende de la iluminaci\u00f3n de los otros EQs. Cada Ateq es independiente y su sonido se suma a la salida.
 */

const ATMAX = 2, ATK = "pioneerAteq", atq = [];
/* INPUT del Ateq: es como el AUX S/W de los EQ, apaga o enciende solo a este Ateq. */
function atInPaint(a) {
    if (!a || !a.inb)
        return;
    a.inb.classList.toggle("on", !a.byp);
    a.inb.setAttribute("aria-pressed", String(!a.byp));
    a.el && a.el.classList.toggle("atoff", !!a.byp);
}
const AT_DEF = [
    { id: "vol", lab: "VOL", d: 8.8, min: 0, max: 1, def: 2 / 3, st: .01, f: x => Math.round(x * 150) + "%" },
    { id: "sub", lab: "SUB", d: 6.4, min: -12, max: 12, def: 0, st: .5, bi: 1, f: x => (x > 0 ? "+" : "") + Math.round(x / 12 * 100) + "%" },
    { id: "fader", lab: "FADER", d: 6.4, min: -12, max: 12, def: 0, st: .5, bi: 1, f: x => x === 0 ? "CENTRO" : (x > 0 ? "F" : "R") + Math.round(Math.abs(x) / 12 * 100) + "%" },
    { id: "sb", lab: "SUB BASS", d: 6.4, min: -12, max: 12, def: 0, st: .5, bi: 1, f: sgn },
    { id: "mb", lab: "MID BASS", d: 6.4, min: -12, max: 12, def: 0, st: .5, bi: 1, f: sgn },
    { id: "md", lab: "MID", d: 6.4, min: -12, max: 12, def: 0, st: .5, bi: 1, f: sgn },
    { id: "tr", lab: "TREBLE", d: 6.4, min: -12, max: 12, def: 0, st: .5, bi: 1, f: sgn }
];

function atSave() {
    try { localStorage.setItem(ATK, JSON.stringify({ u: atq.map(a => ({ v: a.vals, c: a.led, b: a.byp ? 1 : 0 })) })); } catch (e) { }
}

function atNodes(c) {
    const mk = (type, f, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
    const sb = mk("lowshelf", 100), sbc = mk("lowshelf", 250), hp1 = mk("highpass", 15, .707), hp2 = mk("highpass", 15, .707), fd = mk("highshelf", 3500);
    /* Campanas anchas y suaves (Q bajo) para que los tonos suenen musicales y no como filtros agudos */
    const b1 = mk("peaking", 48, .8), b2 = mk("peaking", 150, .75), b3 = mk("peaking", 1400, .65), b4 = mk("highshelf", 6500), mg = c.createGain();
    [sb, sbc, hp1, hp2, fd, b1, b2, b3, b4, mg].reduce((x, y) => (x.connect(y), y));
    return { in: sb, out: mg, sb, sbc, hp1, hp2, fd, b1, b2, b3, b4, mg };
}

function atApply(a) {
    const n = a.nodes;
    if (!n || !AC) return;
    /* subir: hasta +9 dB; bajar: hasta -18 dB (antes -40 dB, que cortaba la musica de golpe) */
    const tt = AC.currentTime, s = (p, x) => p.setTargetAtTime(x, tt, .05), V = a.vals, tone = x => x < 0 ? x * 1.5 : x * .75;
    const sv = Math.min(12, V.sub + (typeof BASSX === "number" ? BASSX : 0)), hf = 15 * Math.pow(100 / 15, Math.max(-sv, 0) / 12);
    s(n.sb.gain, Math.max(sv, 0) * .8);
    s(n.sbc.gain, Math.min(sv, 0) * 2);
    s(n.hp1.frequency, hf);
    s(n.hp2.frequency, hf);
    s(n.fd.gain, V.fader < 0 ? V.fader * .9 : V.fader * .25);
    const g = [tone(V.sb), tone(V.mb), tone(V.md), tone(V.tr)];
    s(n.b1.gain, g[0]);
    s(n.b2.gain, g[1]);
    s(n.b3.gain, g[2]);
    s(n.b4.gain, g[3]);
    /* margen: al subir graves o agudos el nivel total crece y el limitador final distorsiona; se baja un poco el volumen para compensarlo */
    const up = Math.max(0, g[0], g[1], g[2], g[3]) + Math.max(sv, 0) * .8 * .5;
    s(n.mg.gain, a.byp ? 0 : V.vol * 1.5 * EQX * VG * Math.pow(10, -up * .55 / 20));   /* apagado = no suena */
}

/* Llamadas desde ecualizador.js */
function ateqWire() {
    if (!AC || !eqPre || !eqBus) return;
    atq.forEach(a => {
        if (!a.nodes) a.nodes = atNodes(AC);
        try { a.nodes.out.disconnect(); } catch (e) { }
        try { eqPre.disconnect(a.nodes.in); } catch (e) { }
        eqPre.connect(a.nodes.in);
        a.nodes.out.connect(eqBus);
        atApply(a);
    });
}
function ateqApply() { atq.forEach(atApply); }
function ateqCount() { return atq.filter(a => !a.byp).length; }

function atPaint(a, k) {
    const x = a.vals[k.id], n = (x - k.min) / (k.max - k.min), pos = n * 270;
    k.cp.style.transform = "rotate(" + (pos - 135) + "deg)";
}

/* Como el equipo real no tiene pantallitas: el valor se ve un momento en el lugar del nombre */
function atFlash(k, x) {
    if (!k.lb || streamMode) return;
    k.lb.textContent = k.f(x);
    clearTimeout(k.tm);
    k.tm = setTimeout(() => { k.lb.textContent = k.lab; }, 1300);
}

function atSet(a, k, x, user) {
    x = Math.min(k.max, Math.max(k.min, Math.round(x / k.st) * k.st));
    if (x === a.vals[k.id]) return;
    a.vals[k.id] = x;
    atPaint(a, k);
    atApply(a);
    if (user) {
        atSave();
        atFlash(k, x);
        if (on && !streamMode) ov("ATEQ" + (a.i + 1) + " " + up(k.lab) + " " + k.f(x));
    }
}

function atBind(a, k) {
    const el = k.el, st = (k.max - k.min) / (k.bi ? 24 : 20);
    let dr = null;
    el.addEventListener("pointerdown", e => {
        dr = { id: e.pointerId, y: e.clientY, v: a.vals[k.id] };
        try { el.setPointerCapture(e.pointerId); } catch (x) { }
        el.focus({ preventScroll: true });
    });
    el.addEventListener("pointermove", e => {
        if (dr && dr.id === e.pointerId) atSet(a, k, dr.v + (dr.y - e.clientY) / 150 * (k.max - k.min), true);
    });
    const end = e => { if (dr && dr.id === e.pointerId) dr = null; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("wheel", e => { e.preventDefault(); atSet(a, k, a.vals[k.id] + (e.deltaY < 0 ? 1 : -1) * st, true); }, { passive: false });
    el.addEventListener("dblclick", () => atSet(a, k, k.def, true));
    el.addEventListener("keydown", e => {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (d) { e.preventDefault(); e.stopPropagation(); atSet(a, k, a.vals[k.id] + d * st, true); }
    });
}

function atBuild(a) {
    const w = document.createElement("div");
    w.className = "atq";
    w.innerHTML = '<div class="atp"><div class="atplate">' +
        '<svg class="atsv" viewBox="0 0 1332 167" preserveAspectRatio="none" aria-hidden="true"><path d="M262 23H1110L1132 50V125L1110 150H262L230 122V50Z"/></svg>' +
        '<span class="atdc" style="left:' + (392 / 13.32) + 'cqw;top:11.2cqw">FRONT \u25CF</span>' +
        '<span class="atdc" style="left:' + (504 / 13.32) + 'cqw;top:11.2cqw">\u25CF REAR &nbsp;\u25AA1 &nbsp;\u25AA2</span>' +
        '<span class="atdc" style="left:' + (660 / 13.32) + 'cqw;top:11.2cqw">\u25AA1 &nbsp;\u25AA2</span>' +
        '<b class="atlogo">ATEQ</b></div></div>';
    const plate = w.querySelector(".atplate");
    const put = (x, lab, node, d, ly) => {
        const c = document.createElement("div"), l = document.createElement("div");
        c.className = "atc";
        c.style.left = (x / 13.32) + "%";
        c.style.setProperty("--d", d + "cqw");
        c.style.setProperty("--ly", ly + "cqw");
        l.className = "atl"; l.textContent = lab;
        c.append(l, node);
        plate.appendChild(c);
        return l;
    };
    const X = { vol: 169, sub: 320, fader: 459, sb: 792, mb: 917, md: 1044, tr: 1177 };
    a.k.forEach(k => {
        const el = mkKnob(k.d);
        el.tabIndex = 0;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-label", "Ateq " + k.lab);
        k.el = el; k.cp = el.querySelector(".kcap");
        k.lb = put(X[k.id], k.lab, el, k.d, k.id === "vol" ? 1.6 : 2.55);
        atBind(a, k);
    });
    /* INPUT: solo de adorno (como en el equipo real) */
    const inp = document.createElement("button");
    inp.type = "button"; inp.className = "atbt atin"; inp.setAttribute("aria-label", "INPUT: apaga los EQ normales");
    inp.innerHTML = "<i></i>";
    inp.title = "INPUT: apaga los EQ normales";
    a.inb = inp;
    const il = put(570, "INPUT", inp, 4.6, 2.55);
    inp.addEventListener("click", () => {
        a.byp = !a.byp;
        atInPaint(a); atApply(a); atSave();
        if (typeof busGain === "function") busGain();
        if (!streamMode) { il.textContent = a.byp ? "APAGADO" : "ACTIVO"; clearTimeout(a.tm2); a.tm2 = setTimeout(() => { il.textContent = "INPUT"; }, 1300); }
        if (on && !streamMode) ov("ATEQ" + (a.i + 1) + " " + (a.byp ? "OFF" : "ON"));
    });
    /* LED: solo azul o rojo, propio de este Ateq */
    const led = document.createElement("button");
    led.type = "button"; led.className = "atbt"; led.setAttribute("aria-label", "LED del Ateq (azul o rojo)");
    led.innerHTML = "<i></i>";
    const lv = put(680, "LED", led, 4.6, 2.55);
    const pl = () => { w.classList.toggle("red", a.led === "red"); led.title = a.led === "red" ? "LED: rojo" : "LED: azul"; };
    led.addEventListener("click", () => {
        a.led = a.led === "red" ? "blue" : "red";
        pl(); atSave();
        if (!streamMode) { lv.textContent = a.led === "red" ? "ROJO" : "AZUL"; clearTimeout(a.tm); a.tm = setTimeout(() => { lv.textContent = "LED"; }, 1300); }
        if (on && !streamMode) ov("ATEQ" + (a.i + 1) + " LED " + (a.led === "red" ? "RED" : "BLUE"));
    });
    a.k.forEach(k => atPaint(a, k));
    pl();
    a.el = w;
    atInPaint(a);
    $("atqs").appendChild(w);
}

function atMk(saved) {
    const a = { i: atq.length, vals: {}, led: "blue", k: AT_DEF.map(d => Object.assign({}, d)), nodes: null, byp: false };
    a.k.forEach(k => a.vals[k.id] = k.def);
    if (saved) {
        a.k.forEach(k => { const x = saved.v && saved.v[k.id]; if (typeof x === "number") a.vals[k.id] = Math.min(k.max, Math.max(k.min, x)); });
        if (saved.c === "red") a.led = "red";
    }
    atq.push(a);
    if (saved && saved.b) a.byp = true;
    atBuild(a);
    atInPaint(a);
    if (AC) ateqWire();
    return a;
}

function atCtl() {
    $("atn").textContent = atq.length + "/" + ATMAX;
    $("ata").disabled = atq.length >= ATMAX;
    $("atm").disabled = atq.length <= 0;
}

function atAdd() {
    if (atq.length >= ATMAX) return;
    atMk(null);
    atSave(); atCtl();
    if (typeof applyOrder === "function") applyOrder();
    if (typeof busGain === "function") busGain();
    if (on) ov("ATEQ " + atq.length + " ADDED");
}

function atRm() {
    const a = atq.pop();
    if (!a) return;
    if (a.nodes) { try { a.nodes.out.disconnect(); } catch (e) { } try { eqPre.disconnect(a.nodes.in); } catch (e) { } }
    a.el.remove();
    atSave(); atCtl();
    if (typeof applyOrder === "function") applyOrder();
    if (typeof busGain === "function") busGain();
    if (on) ov("ATEQ " + (atq.length + 1) + " REMOVED");
}

{
    let sv = null;
    try { sv = JSON.parse(localStorage.getItem(ATK)); } catch (e) { }
    if (sv && Array.isArray(sv.u)) sv.u.slice(0, ATMAX).forEach(x => atMk(x));
    atCtl();
    $("ata") && $("ata").addEventListener("click", atAdd);
    $("atm") && $("atm").addEventListener("click", atRm);
}

/* Si el Ateq queda justo encima de la radio, se pega a ella: cada modelo de radio deja un espacio transparente distinto arriba de su imagen. */
const atTop = {};
function atVisTop(img) {
    const src = img.currentSrc || img.src;
    if (!src || !img.naturalWidth)
        return null;
    if (src in atTop)
        return atTop[src];
    let r = null;
    try {
        const W = 120, H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth)), cv = document.createElement("canvas"), x = cv.getContext("2d", { willReadFrequently: true });
        cv.width = W; cv.height = H;
        x.drawImage(img, 0, 0, W, H);
        const d = x.getImageData(0, 0, W, H).data;
        const x0 = Math.round(W * .1), x1 = Math.round(W * .9), need = Math.max(3, (x1 - x0) * .08);
        for (let j = 0; j < H && r === null; j++) {
            let n = 0;
            for (let i = x0; i < x1; i++) {
                const k = (j * W + i) * 4;
                if (d[k + 3] > 40 && Math.max(d[k], d[k + 1], d[k + 2]) > 34)
                    n++;
            }
            if (n >= need)
                r = j / H;
        }
    }
    catch (e) { r = null; }
    atTop[src] = r;
    return r;
}
function atFit() {
    const f = $("face"), im = document.querySelector("#face img.bg");
    if (!f || !im)
        return;
    atq.forEach(a => {
        a.el.style.marginBottom = "";
        if (a.el.nextElementSibling !== f.closest(".wrap"))
            return;
        const t = atVisTop(im);
        if (t === null)
            return;
        const ib = im.getBoundingClientRect(), gap = ib.top + t * ib.height - a.el.getBoundingClientRect().bottom;
        if (gap > 2)
            a.el.style.marginBottom = -(gap - 3) + "px";
    });
}
{
    let tm = 0;
    const go = () => { clearTimeout(tm); tm = setTimeout(atFit, 60); };
    window.addEventListener("resize", go);
    window.addEventListener("load", go);
    { const bi = document.querySelector("#face img.bg"); if (bi) bi.addEventListener("load", go); }
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(go), es = $("eqs");
        if (es) ro.observe(es);
        const f = $("face");
        if (f) ro.observe(f);
    }
    window.atFitSoon = go;
}

;
/**
 * Procesador de audio (parte del pase "Crossover y Procesador").
 * Es otro equipo distinto del Crossover: no divide frecuencias, sino que MEJORA la calidad de la salida.
 *  SUBSONIC: corta los graves que no se oyen y solo gastan potencia.
 *  BASS ENH: arma graves "con cuerpo" (armónicos) para que se sientan sin subir el volumen.
 *  CLARITY: claridad y presencia en medios y agudos.
 *  LOUDNESS: contorno de volumen bajo (más graves y agudos).
 *  WIDTH: ancho estéreo (0% mono, 100% normal, 200% muy ancho).
 *  COMPRESSOR: compresión suave que controla los picos.
 *  OUTPUT: volumen de salida. Un limitador al final evita que sature.
 * Funciona como un EQ: se suma a la salida junto con los demás.
 */

const PRD = { sb: .3, be: .35, cl: .4, ld: .15, wd: .5, cp: .3, ou: 2 / 3 }, PRW = { on: 1 };
const PRKN = [
    { id: "sb", lab: "SUBSONIC", nm: "SUBSONIC", f: v => crTxt(prSub(v)) },
    { id: "be", lab: "BASS ENH", nm: "BASS ENHANCE", f: v => Math.round(v * 100) + "%" },
    { id: "cl", lab: "CLARITY", nm: "CLARITY", f: v => Math.round(v * 100) + "%" },
    { id: "ld", lab: "LOUDNESS", nm: "LOUDNESS", f: v => Math.round(v * 100) + "%" },
    { id: "wd", lab: "WIDTH", nm: "WIDTH", f: v => Math.round(v * 200) + "%" },
    { id: "cp", lab: "COMPRESSOR", nm: "COMPRESSOR", f: v => Math.round(v * 100) + "%" },
    { id: "ou", lab: "OUTPUT", nm: "OUTPUT", f: v => Math.round(v * 150) + "%" }
];
/* El compresor de Web Audio sube el volumen solo (makeup). Valores medidos para cada cantidad (0, .25, .5, .75, 1): se compensan para que mejorar no sea sonar más fuerte. */
const PRMK = [1.143, 1.407, 1.966, 2.82, 4.088];
const prSub = v => 15 * Math.pow(3, v);
const prMk = a => { const p = Math.min(.9999, Math.max(0, a)) * 4, i = Math.floor(p), t = p - i; return PRMK[i] + (PRMK[i + 1] - PRMK[i]) * t; };

function prNodes(c) {
    const mk = (type, f, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; };
    const g = v => { const n = c.createGain(); n.gain.value = v === undefined ? 1 : v; return n; };
    const Q = -3.0103, inn = g(), sub = mk("highpass", 22, Q), dry = g(), mix = g();
    /* graves con cuerpo: banda baja -> saturación suave -> solo los armónicos -> se mezcla con el original */
    const bl = mk("lowpass", 110, Q), sh = c.createWaveShaper(), bh = mk("highpass", 70, Q), bg = g(0);
    const cu = new Float32Array(1025);
    for (let i = 0; i < 1025; i++) { const x = i / 512 - 1; cu[i] = Math.tanh(3 * x) / Math.tanh(3); }
    sh.curve = cu;
    const cl = mk("highshelf", 9000), pr = mk("peaking", 3500, 0.8), l1 = mk("lowshelf", 100), l2 = mk("highshelf", 10000);
    /* ancho estéreo: medio (M) y lados (S) */
    const spl = c.createChannelSplitter(2), mrg = c.createChannelMerger(2), mL = g(.5), mR = g(.5), sL = g(.5), sR = g(-.5), M = g(), S = g(1), inv = g(-1);
    const cmp = c.createDynamicsCompressor(), mkp = g(), lim = c.createDynamicsCompressor(), out = g(), an = c.createAnalyser();
    lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .1;
    an.fftSize = 1024;
    /* siempre en estereo: con musica mono el ancho estereo (M/S) bajaba el volumen a la mitad */
    inn.channelCount = 2; inn.channelCountMode = "explicit"; inn.channelInterpretation = "speakers";
    inn.connect(sub); sub.connect(dry); dry.connect(mix);
    sub.connect(bl); bl.connect(sh); sh.connect(bh); bh.connect(bg); bg.connect(mix);
    mix.connect(cl); cl.connect(pr); pr.connect(l1); l1.connect(l2); l2.connect(spl);
    spl.connect(mL, 0); spl.connect(mR, 1); spl.connect(sL, 0); spl.connect(sR, 1);
    mL.connect(M); mR.connect(M); sL.connect(S); sR.connect(S);
    M.connect(mrg, 0, 0); M.connect(mrg, 0, 1); S.connect(mrg, 0, 0); S.connect(inv); inv.connect(mrg, 0, 1);
    mrg.connect(cmp); cmp.connect(mkp); mkp.connect(lim); lim.connect(out); out.connect(an);
    return { in: inn, out, sub, bg, cl, pr, l1, l2, S, cmp, mkp, lim, an };
}

function prApply(u) {
    const n = u.nodes;
    if (!n || !AC)
        return;
    const tt = AC.currentTime, s = (p, x) => p.setTargetAtTime(x, tt, .03), V = u.v, z = u.w.on ? 1 : 0;
    s(n.sub.frequency, z ? prSub(V.sb) : 1);
    s(n.bg.gain, z ? V.be * 1.6 : 0);
    s(n.cl.gain, z ? V.cl * 6 : 0);
    s(n.pr.gain, z ? V.cl * 2 : 0);
    s(n.l1.gain, z ? V.ld * 8 : 0);
    s(n.l2.gain, z ? V.ld * 4 : 0);
    s(n.S.gain, z ? V.wd * 2 : 1);
    s(n.cmp.threshold, z ? -8 - 22 * V.cp : 0);
    s(n.cmp.ratio, z ? 1.4 + 4 * V.cp : 1);
    n.cmp.knee.value = z ? 14 : 0;
    n.cmp.attack.value = .012;
    n.cmp.release.value = .25;
    s(n.mkp.gain, z ? 1 / prMk(V.cp) : 1 / prMk(0));
    s(n.out.gain, z ? V.ou * 1.5 : 1);
}

/* Medidor de salida del LCD (solo mientras la radio está encendida y la pestaña visible) */
let prRaf = 0, prBuf = null;
function prMeters() {
    prRaf = 0;
    const ps = crx.filter(u => u.t === "p" && u.lcd);
    if (!ps.length)
        return;
    if (!document.hidden) {
        ps.forEach(u => {
            let lv = 0;
            if (u.nodes && on) {
                if (!prBuf || prBuf.length !== u.nodes.an.fftSize)
                    prBuf = new Float32Array(u.nodes.an.fftSize);
                u.nodes.an.getFloatTimeDomainData(prBuf);
                let m = 0;
                for (let i = 0; i < prBuf.length; i++) m += prBuf[i] * prBuf[i];
                const db = 10 * Math.log10(m / prBuf.length + 1e-12);
                lv = Math.max(0, Math.min(1, (db + 54) / 54));
            }
            u.lv = Math.max(lv, (u.lv || 0) - .06);
            const k = Math.round(u.lv * u.bars.length);
            u.bars.forEach((b, i) => b.classList.toggle("lit", i < k));
        });
    }
    prRaf = setTimeout(() => requestAnimationFrame(prMeters), 40);
}
function prMeterGo() {
    if (!prRaf)
        prRaf = setTimeout(() => requestAnimationFrame(prMeters), 40);
}

function prBuild(u) {
    const w = document.createElement("div");
    w.className = "prq";
    w.innerHTML = '<div class="prp"><div class="prplate"><div class="prlcd"><div class="prt">AUDIO PROCESSOR</div><div class="prbars"></div><div class="prsc"><span>-54</span><span>-36</span><span>-18</span><span>0 dB</span></div><div class="prm">READY</div></div><b class="prcap">PROCESSOR</b></div></div>';
    const pl = w.querySelector(".prplate"), lcd = w.querySelector(".prlcd"), bx = w.querySelector(".prbars"), msg = w.querySelector(".prm");
    const at = (el, x, y) => { el.style.left = x + "cqw"; el.style.top = y + "cqw"; pl.appendChild(el); return el; };
    u.bars = [];
    for (let i = 0; i < 24; i++) { const b = document.createElement("i"); if (i >= 17) b.className = "hot"; else if (i >= 12) b.className = "mid"; bx.appendChild(b); u.bars.push(b); }
    u.lcd = lcd;
    const show = t => {
        msg.textContent = t;
        clearTimeout(u.tm);
        u.tm = setTimeout(() => { msg.textContent = u.w.on ? "READY" : "BYPASS"; }, 1500);
    };
    PRKN.forEach((k0, i) => {
        const k = Object.assign({}, k0), el = mkKnob(7.2), x = 36.2 + i * 8.5;
        el.tabIndex = 0;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-label", "Procesador " + k.lab);
        k.el = el; k.cp = el.querySelector(".kcap");
        at(el, x, 15.4).classList.add("prkn");
        const l = document.createElement("div");
        l.className = "prlb";
        l.textContent = k.lab;
        at(l, x, 6.8);
        k.show = t => { if (!streamMode) show(k.nm + " " + t); };
        crBind(u, k);
        u.k.push(k);
        crPaint(u, k);
    });
    const pb = document.createElement("button"), pl2 = document.createElement("div");
    pb.type = "button"; pb.className = "crpb prb"; pb.setAttribute("role", "switch"); pb.setAttribute("aria-label", "Procesador encendido o apagado");
    pb.innerHTML = "<i></i>";
    pl2.className = "prlb";
    pl2.textContent = "ON / OFF";
    at(pb, 96.2, 15.4);
    at(pl2, 96.2, 6.8);
    const paint = () => { pb.classList.toggle("on", !!u.w.on); pb.setAttribute("aria-checked", String(!!u.w.on)); msg.textContent = u.w.on ? "READY" : "BYPASS"; };
    pb.onclick = () => {
        u.w.on = u.w.on ? 0 : 1;
        paint(); crApply(u); crSave();
        if (on && !streamMode)
            ov("PROCESSOR " + (u.i + 1) + " " + (u.w.on ? "ON" : "OFF"));
    };
    paint();
    u.el = w;
    $("crxs").appendChild(w);
    prMeterGo();
}

;
/**
 * Pase "Crossover y Procesador" ($5)
 * Un procesador de audio que funciona como un EQ pero cuida m\u00e1s la calidad de la salida:
 *  - Crossover de 24 dB/octava (Linkwitz-Riley): FRONT y REAR pasa-altos, SUB pasa-bajos, que suman plano.
 *  - SUB con BASS BOOST (+12 dB), PHASE (0\u00b0/180\u00b0) y MODE (STEREO/MONO), como un crossover de carro.
 *  - PROCESADOR: filtro subs\u00f3nico, un toque de claridad en agudos y compresi\u00f3n suave para que no sature.
 * Hasta 2 unidades. Cada una es independiente y su sonido se suma a la salida igual que los otros EQs.
 */

/*
 * GLOSARIO (nombres cortos de este archivo)
 *   crx      lista de equipos de este pase en pantalla (maximo CRMAX = 1; solo se usa UNO).
 *   u.t      tipo: "x" = Crossover, "p" = Procesador.
 *   u.v      perillas normalizadas 0..1 (ff/fl = frecuencia/nivel FRONT, rf/rl = REAR, sf/sl = SUB).
 *   u.w      interruptores (mul = x20, pi = parallel input, bb = bass boost, ph = fase, mo = mono).
 *   crHz()   convierte una perilla 0..1 a Hz.
 *   croWire  conecta el equipo en serie despues de los EQ (si no hay, el audio pasa directo).
 *   crWs     estado de la ventana flotante (x, y, m = minimizada, h = oculta).
 */

const CRMAX = 1, CRK = "pioneerCrx", crx = [];
let cro = true, crnew = false, crSel = "x";

try {
    cro = true;
}
catch (e) { }

const CRD = { ff: .12, fl: 2 / 3, rf: 0, rl: 0, sf: .36, sl: .3 }, CRW = { mul: 0, pi: 1, bb: 0, ph: 0, mo: 0, pr: 0 };
const crHz = (v, a, b) => a * Math.pow(b / a, v);
const crTxt = hz => hz >= 1000 ? (hz / 1000).toFixed(hz >= 10000 ? 0 : 1) + "kHz" : Math.round(hz) + "Hz";

/* ---------- Audio ---------- */
/* En Web Audio el Q de un pasa-altos/pasa-bajos va en dB: -3.01 dB = Butterworth exacto (dos en fila = Linkwitz-Riley de 24 dB, que suma plano). */
function crNodes(c) {
    const mk = (type, f, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
    const Q = -3.0103, inn = c.createGain(), sum = c.createGain(), out = c.createGain();
    const f1 = mk("highpass", 32, Q), f2 = mk("highpass", 32, Q), gF = c.createGain();
    const l1 = mk("lowpass", 900, Q), l2 = mk("lowpass", 900, Q), gL = c.createGain();   /* x20: lo que queda debajo del corte (voces) se conserva */
    gL.gain.value = 0;
    const r1 = mk("highpass", 32, Q), r2 = mk("highpass", 32, Q), gR = c.createGain();
    const s1 = mk("lowpass", 90, Q), s2 = mk("lowpass", 90, Q), bb = mk("lowshelf", 50), mono = c.createGain(), ph = c.createGain(), gS = c.createGain();
    mono.channelCountMode = "explicit";
    mono.channelInterpretation = "speakers";
    [[inn, l1], [l1, l2], [l2, gL], [gL, sum], [inn, f1], [f1, f2], [f2, gF], [gF, sum], [inn, r1], [r1, r2], [r2, gR], [gR, sum], [inn, s1], [s1, s2], [s2, bb], [bb, mono], [mono, ph], [ph, gS], [gS, sum], [sum, out]].forEach(p => p[0].connect(p[1]));
    return { in: inn, out, l1, l2, gL, f1, f2, gF, r1, r2, gR, s1, s2, bb, mono, ph, gS };
}

function crApply(u) {
    if (u.t === "p")
        return prApply(u);
    const n = u.nodes;
    if (!n || !AC)
        return;
    const tt = AC.currentTime, s = (p, x) => p.setTargetAtTime(x, tt, .03), V = u.v, W = u.w;
    const ff = Math.min(20000, crHz(V.ff, 32, 600) * (W.mul ? 20 : 1)), rf = crHz(V.rf, 32, 600), sf = crHz(V.sf, 32, 400);
    [n.f1, n.f2].forEach(f => s(f.frequency, ff));
    [n.l1, n.l2].forEach(f => s(f.frequency, ff));
    /* con x20 el FRONT ajusta solo los agudos (tweeter/driver): lo de abajo pasa completo, asi las voces no se pierden */
    s(n.gL.gain, W.mul ? 1 : 0);
    [n.r1, n.r2].forEach(f => s(f.frequency, rf));
    [n.s1, n.s2].forEach(f => s(f.frequency, sf));
    s(n.gF.gain, V.fl * 1.5);
    s(n.gR.gain, W.pi ? V.rl * 1.5 : 0);   /* PARALLEL INPUT en CUT: el REAR se queda sin entrada */
    s(n.gS.gain, V.sl * 1.5);
    s(n.bb.gain, W.bb ? 12 : 0);
    s(n.ph.gain, W.ph ? -1 : 1);
    n.mono.channelCount = W.mo ? 1 : 2;
    /* el compresor de Web Audio sube el volumen solo (makeup): se compensa para que el procesador mejore el sonido sin hacerlo m\u00e1s fuerte */
    s(n.out.gain, 1);
}

/* Llamadas desde ecualizador.js */
/* Va EN SERIE al final de los EQ (mezcla de EQ -> Crossover/Procesador -> salida): mejora lo que ya suena. Si todos los EQ estan apagados, no hay nada que mejorar y no suena. */
function croWire() {
    if (!AC || !eqBus || !eqCp)
        return;
    try { eqBus.disconnect(eqCp); } catch (e) { }
    crx.forEach(u => {
        if (u.nodes) {
            try { u.nodes.out.disconnect(); } catch (e) { }
            try { eqBus.disconnect(u.nodes.in); } catch (e) { }
        }
    });
    const u = crx[0];
    if (!u) {
        eqBus.connect(eqCp);
        return;
    }
    if (!u.nodes)
        u.nodes = u.t === "p" ? prNodes(AC) : crNodes(AC);
    eqBus.connect(u.nodes.in);
    u.nodes.out.connect(eqCp);
    crApply(u);
}
function croApply() { crx.forEach(crApply); }
function croCount() { return crx.length; }
function croLat() { return 0; }

/* ---------- Guardado ---------- */
let crSaved = null;
function crLoad() {
    try {
        const s = JSON.parse(localStorage.getItem(CRK));
        return s && Array.isArray(s.u) ? s.u.slice(0, CRMAX) : [];
    }
    catch (e) { return []; }
}
function crSave() {
    crSaved = crx.map(u => ({ t: u.t, v: u.v, w: u.w }));
    try { localStorage.setItem(CRK, JSON.stringify({ u: crSaved })); } catch (e) { }
}

/* ---------- Pantalla ---------- */
/* Medidas en el sistema de coordenadas de la foto del equipo real (viewBox 158 168 632 607): as\u00ed todo queda en su sitio. */
const CRKN = [
    { id: "ff", lab: "FREQUENCY", x: 305, y: 285, ly: 246, d: 60, f: (v, u) => crTxt(Math.min(20000, crHz(v, 32, 600) * (u.w.mul ? 20 : 1))), nm: "FRONT FREQ" },
    { id: "fl", lab: "LEVEL", x: 647, y: 291, ly: 246, d: 58, f: v => Math.round(v * 150) + "%", nm: "FRONT LEVEL" },
    { id: "rf", lab: "FREQUENCY", x: 305, y: 408, ly: 366, d: 60, f: v => crTxt(crHz(v, 32, 600)), nm: "REAR FREQ" },
    { id: "rl", lab: "LEVEL", x: 647, y: 412, ly: 367, d: 58, f: v => Math.round(v * 150) + "%", nm: "REAR LEVEL" },
    { id: "sf", lab: "FREQUENCY", x: 303, y: 532, ly: 490, d: 60, f: v => crTxt(crHz(v, 32, 400)), nm: "SUB FREQ" },
    { id: "sl", lab: "LEVEL", x: 649, y: 530, ly: 490, d: 58, f: v => Math.round(v * 150) + "%", nm: "SUB LEVEL" }
];
/* h: horizontal (valor 1 = derecha) o vertical (valor 1 = arriba). t: [texto del valor 0, texto del valor 1] y d\u00f3nde van. */
const CRSW = [
    { id: "mul", nm: "MULTIPLIER", x: 477, y: 287, h: 1, t: [["X1", 457, 311], ["X20", 500, 311]] },
    { id: "pi", nm: "PARALLEL INPUT", x: 304, y: 349, h: 1, inv: 1, t: [["CUT", 327, 331], ["IN", 290, 331]] },
    { id: "bb", nm: "BASS BOOST", x: 388, y: 538, t: [["0dB", 414, 563], ["+12dB", 416, 517]] },
    { id: "ph", nm: "PHASE", x: 478, y: 533, t: [["0\u00b0", 497, 552], ["180\u00b0", 500, 515]] },
    { id: "mo", nm: "MODE", x: 568, y: 531, t: [["STEREO", 593, 563], ["MONO", 592, 517]] }
];

function crPaint(u, k) {
    const x = u.v[k.id];
    k.cp.style.transform = "rotate(" + (x * 270 - 135) + "deg)";
}

function crSet(u, k, x, user) {
    x = Math.min(1, Math.max(0, Math.round(x * 100) / 100));
    if (x === u.v[k.id])
        return;
    u.v[k.id] = x;
    crPaint(u, k);
    crApply(u);
    if (user) {
        crSave();
        crFlash(u, k);
        if (on && !streamMode)
            ov((u.t === "p" ? "PROC" : "CROSS") + (u.i + 1) + " " + k.nm + " " + k.f(x, u));
    }
}

function crFlash(u, k) {
    if (k.show) {
        k.show(k.f(u.v[k.id], u));
        return;
    }
    if (!k.lb || streamMode)
        return;
    k.lb.textContent = k.f(u.v[k.id], u);
    clearTimeout(k.tm);
    k.tm = setTimeout(() => { k.lb.textContent = k.lab; }, 1300);
}

function crBind(u, k) {
    const el = k.el;
    let dr = null;
    el.addEventListener("pointerdown", e => {
        dr = { id: e.pointerId, y: e.clientY, v: u.v[k.id] };
        try { el.setPointerCapture(e.pointerId); } catch (x) { }
        el.focus({ preventScroll: true });
    });
    el.addEventListener("pointermove", e => {
        if (dr && dr.id === e.pointerId)
            crSet(u, k, dr.v + (dr.y - e.clientY) / 150, true);
    });
    const end = e => { if (dr && dr.id === e.pointerId) dr = null; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("wheel", e => { e.preventDefault(); crSet(u, k, u.v[k.id] + (e.deltaY < 0 ? 1 : -1) * .04, true); }, { passive: false });
    el.addEventListener("dblclick", () => crSet(u, k, u.def[k.id], true));
    el.addEventListener("keydown", e => {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (d) { e.preventDefault(); e.stopPropagation(); crSet(u, k, u.v[k.id] + d * .04, true); }
    });
}

/* Dibujo del equipo (todo lo que no se mueve). Coordenadas de la foto. */
function crArt() {
    const rc = (x, y, w, h, r, f, s, sw) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + f + '"' + (s ? ' stroke="' + s + '" stroke-width="' + (sw || 1) + '"' : "") + "/>";
    const tx = (x, y, s, t, a, cl) => '<text x="' + x + '" y="' + y + '" font-size="' + s + '" text-anchor="' + (a || "middle") + '" class="' + (cl || "") + '">' + t + "</text>";
    const ln = d => '<path d="' + d + '" fill="none" stroke="#e4e6ea" stroke-width="1.3"/>';
    const ys = [262, 323, 382, 440, 501, 563];
    let o = '<defs><linearGradient id="cxb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#202124"/><stop offset=".5" stop-color="#121315"/><stop offset="1" stop-color="#0a0a0b"/></linearGradient>' +
        '<linearGradient id="cxj" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6e7ea"/><stop offset="1" stop-color="#5d5e63"/></linearGradient></defs>';
    /* orejas de montaje */
    o += rc(205, 168, 530, 36, 7, "#16171a", "#2c2d31", 1.5) + rc(262, 178, 60, 18, 9, "#040405", "#8d8e93", 1.5) + rc(622, 178, 68, 18, 9, "#040405", "#8d8e93", 1.5);
    o += rc(205, 733, 535, 42, 7, "#16171a", "#2c2d31", 1.5) + rc(258, 745, 64, 18, 9, "#040405", "#8d8e93", 1.5) + rc(590, 745, 64, 18, 9, "#040405", "#8d8e93", 1.5);
    /* caja */
    o += rc(195, 200, 555, 535, 5, "url(#cxb)", "#303136", 2.2) + rc(199, 204, 547, 527, 3, "none", "#ffffff12", 1);
    /* conectores RCA */
    ys.forEach((y, i) => {
        [[178, 217, 233, "L"], [772, 737, 721, "R"]].forEach((s, j) => {
            o += '<circle cx="' + s[0] + '" cy="' + y + '" r="19" fill="url(#cxj)" stroke="#2a2b2e" stroke-width="2"/><circle cx="' + s[0] + '" cy="' + y + '" r="11" fill="#0b0b0c"/><circle cx="' + s[0] + '" cy="' + y + '" r="5" fill="#9a9ba0"/>';
            o += '<circle cx="' + s[1] + '" cy="' + y + '" r="8" fill="#0d0d0e" stroke="#e9eaed" stroke-width="3"/>';
            o += tx(s[2], y + 4, 10, i % 2 ? "R" : "L", "middle", "crsv");
        });
    });
    o += tx(218, 285, 10, "FRONT", "middle", "crsv") + tx(218, 297, 10, "INPUT", "middle", "crsv") + tx(214, 405, 10, "REAR", "middle", "crsv") + tx(214, 417, 10, "INPUT", "middle", "crsv") + tx(214, 524, 10, "MIXED", "middle", "crsv") + tx(214, 536, 10, "IN/OUT", "middle", "crsv");
    o += tx(737, 285, 10, "FRONT", "middle", "crsv") + tx(737, 297, 10, "OUTPUT", "middle", "crsv") + tx(737, 403, 10, "REAR", "middle", "crsv") + tx(737, 415, 10, "OUTPUT", "middle", "crsv") + tx(737, 526, 10, "SUB", "middle", "crsv") + tx(737, 538, 10, "OUTPUT", "middle", "crsv");
    /* l\u00edneas de se\u00f1al */
    o += ln("M255 291V532") + ln("M255 291H268M255 412H268M255 537H268") + ln("M705 262V325M705 383V440M705 503V565") + ln("M682 291H705M682 412H705M682 530H705");
    o += '<circle cx="255" cy="291" r="3" fill="#e4e6ea"/><circle cx="255" cy="412" r="3" fill="#e4e6ea"/><circle cx="255" cy="537" r="3" fill="#e4e6ea"/><circle cx="693" cy="291" r="3" fill="#e4e6ea"/><circle cx="693" cy="412" r="3" fill="#e4e6ea"/><circle cx="693" cy="530" r="3" fill="#e4e6ea"/>';
    o += ln("M217 262H230M217 323H230M217 382H230M217 440H230M217 501H230M217 563H230");
    o += ln("M374 291H452M503 291H556") + ln("M374 412H612") + ln("M374 537H612");
    /* iconos de filtro y tri\u00e1ngulos */
    [[291, "hp"], [412, "hp"], [537, "lp"]].forEach(a => {
        o += rc(346, a[0] - 14, 28, 28, 2, "none", "#e4e6ea", 1.3);
        o += ln(a[1] === "hp" ? "M352 " + (a[0] + 8) + "L362 " + (a[0] - 8) + "M358 " + (a[0] + 8) + "L368 " + (a[0] - 8) + "M364 " + (a[0] + 8) + "L372 " + (a[0] - 6) : "M350 " + (a[0] - 9) + "L360 " + (a[0] + 9) + "M356 " + (a[0] - 9) + "L366 " + (a[0] + 9) + "M362 " + (a[0] - 9) + "L371 " + (a[0] + 8));
    });
    o += ln("M556 278V304L582 291Z") + ln("M556 399V425L582 412Z") + ln("M582 291H612M582 412H612");
    /* t\u00edtulos con sus l\u00edneas */
    o += ln("M262 247Q262 230 279 230H452M602 230H665Q682 230 682 247") + tx(527, 234, 11.5, "HI-PASS CROSSOVER", "middle", "crh");
    o += ln("M262 450Q262 466 279 466H385M515 466H665Q682 466 682 450") + tx(450, 470, 11.5, "HI-PASS CROSSOVER", "middle", "crh");
    o += ln("M262 580Q262 595 279 595H395M560 595H665Q682 595 682 580") + tx(477, 599, 11.5, "SUBWOOFER CROSSOVER", "middle", "crh");
    /* escalas de las perillas */
    [[285, "40Hz", "125Hz", "32Hz", "600Hz", 305], [408, "40Hz", "125Hz", "32Hz", "600Hz", 305], [532, "70Hz", "180Hz", "32Hz", "400Hz", 303]].forEach(a => {
        o += tx(a[5] - 38, a[0] - 22, 9.5, a[1], "middle", "crsv") + tx(a[5] + 40, a[0] - 22, 9.5, a[2], "middle", "crsv") + tx(a[5] - 38, a[0] + 34, 9.5, a[3], "middle", "crsv") + tx(a[5] + 40, a[0] + 34, 9.5, a[4], "middle", "crsv");
    });
    [[291], [412], [530]].forEach(a => {
        o += tx(622, a[0] + 36, 9.5, "MIN", "middle", "crsv") + tx(682, a[0] + 36, 9.5, "MAX", "middle", "crsv") + ln("M628 " + (a[0] + 27) + "L624 " + (a[0] + 23) + "M676 " + (a[0] + 27) + "L680 " + (a[0] + 23));
    });
    /* textos de los interruptores */
    o += tx(477, 262, 9.5, "FREQUENCY", "middle", "crsv") + tx(477, 273, 9.5, "MULTIPLIER", "middle", "crsv") + tx(366, 351, 9.5, "PARALLEL INPUT", "middle", "crsv");
    o += tx(388, 497, 9.5, "BASS", "middle", "crsv") + tx(388, 508, 9.5, "BOOST", "middle", "crsv") + tx(478, 502, 9.5, "PHASE", "middle", "crsv") + tx(568, 500, 9.5, "MODE", "middle", "crsv");
    /* abajo: bornes, luz de encendido, tornillos y rotulado (sin marca) */
    o += rc(150, 606, 46, 100, 4, "#0a0a0b", "#2c2d31", 1.5);
    [622, 645, 667, 690].forEach((y, i) => {
        o += '<circle cx="172" cy="' + y + '" r="9" fill="#b9babe" stroke="#2c2d31" stroke-width="2"/><path d="M166 ' + y + 'H178M172 ' + (y - 6) + 'V' + (y + 6) + '" stroke="#3a3b3f" stroke-width="1.6"/>';
        o += '<circle cx="212" cy="' + y + '" r="3.2" fill="#e9eaed"/>' + tx(226, y + 4, 10, ["12V", "GND", "REM IN", "REM OUT"][i], "start", "crsv");
    });
    o += tx(305, 636, 9, "POWER", "middle", "crsv") + '<circle cx="305" cy="652" r="6" fill="#1b2b20" stroke="#4a4b50" stroke-width="1.5"/><circle id="crled" cx="305" cy="652" r="3.2" fill="#6ff0a8"/>';
    o += '<circle cx="382" cy="655" r="9" fill="#1d1e21" stroke="#4a4b50" stroke-width="2"/><circle cx="651" cy="655" r="9" fill="#1d1e21" stroke="#4a4b50" stroke-width="2"/>';
    o += '<text x="300" y="706" font-size="35" font-style="italic" font-weight="900" fill="#f1f2f4" class="crh" transform="skewX(-12) translate(150 0)">CROSSOVER</text>';
    o += tx(575, 678, 19, "CX-24", "middle", "crh") + tx(620, 700, 9.5, "MOBILE ELECTRONIC CROSSOVER", "middle", "crsv") + tx(620, 713, 9.5, "24 dB / OCTAVE", "middle", "crsv") + tx(760, 660, 9.5, "REMOTE", "start", "crsv");
    return '<svg class="crart" viewBox="158 168 632 607" preserveAspectRatio="none" aria-hidden="true">' + o + "</svg>";
}

function crBuild(u) {
    const w = document.createElement("div");
    w.className = "crq";
    w.innerHTML = '<div class="crp"><div class="crplate">' + crArt() + "</div></div>";
    const pl = w.querySelector(".crplate"), X = x => ((x - 158) / 632 * 100) + "%", Y = y => ((y - 168) / 607 * 100) + "%";
    const at = (el, x, y) => { el.style.left = X(x); el.style.top = Y(y); pl.appendChild(el); return el; };
    const lab = (txt, x, y, cl) => { const d = document.createElement("div"); d.className = "crtx " + (cl || ""); d.textContent = txt; return at(d, x, y); };
    CRKN.forEach(k0 => {
        const k = Object.assign({}, k0), el = mkKnob(k.d / 6.32);
        el.tabIndex = 0;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-label", "Crossover " + k.nm);
        k.el = el; k.cp = el.querySelector(".kcap");
        at(el, k.x, k.y).classList.add("crkn");
        k.lb = lab(k.lab, k.x, k.ly, "crlb");
        crBind(u, k);
        u.k.push(k);
        crPaint(u, k);
    });
    /* Interruptores deslizantes. El valor activo se ilumina. */
    CRSW.forEach(s => {
        const b = document.createElement("button"), tv = s.t.map(t => lab(t[0], t[1], t[2], "crvl"));
        b.type = "button"; b.className = "crsw " + (s.h ? "h" : "v"); b.setAttribute("role", "switch"); b.setAttribute("aria-label", s.nm);
        b.innerHTML = "<i></i>";
        at(b, s.x, s.y);
        const paint = () => {
            const on1 = !!u.w[s.id];
            b.classList.toggle("on", on1);
            b.setAttribute("aria-checked", String(on1));
            tv[0].classList.toggle("sel", !on1);
            tv[1].classList.toggle("sel", on1);
        };
        b.onclick = () => {
            u.w[s.id] = u.w[s.id] ? 0 : 1;
            paint();
            if (s.id === "mul") crFlash(u, u.k[0]);
            crApply(u); crSave();
            if (on && !streamMode)
                ov("CROSS" + (u.i + 1) + " " + s.nm + " " + s.t[u.w[s.id] ? 1 : 0][0]);
        };
        paint();
    });
    u.el = w;
    $("crxs").appendChild(w);
}

function crCnt(t) {
    return crx.filter(u => u.t === t).length;
}

function crMk(saved, t) {
    t = saved && saved.t === "p" ? "p" : (t || "x");
    const D = t === "p" ? PRD : CRD, W = t === "p" ? PRW : CRW;
    const u = { i: crCnt(t), t, def: D, v: Object.assign({}, D), w: Object.assign({}, W), k: [], nodes: null };
    if (saved) {
        Object.keys(D).forEach(k => { const x = saved.v && saved.v[k]; if (typeof x === "number") u.v[k] = Math.min(1, Math.max(0, x)); });
        Object.keys(W).forEach(k => { const x = saved.w && saved.w[k]; if (x === 0 || x === 1) u.w[k] = x; });
    }
    crx.push(u);
    t === "p" ? prBuild(u) : crBuild(u);
    if (AC)
        croWire();
    return u;
}

function crClear() {
    while (crx.length) {
        const u = crx.pop();
        if (u.nodes) {
            try { u.nodes.out.disconnect(); } catch (e) { }
            try { eqBus.disconnect(u.nodes.in); } catch (e) { }
        }
        u.el.remove();
    }
    croWire();
    if (typeof busGain === "function")
        busGain();
}

/* ---------- Ventana flotante (movible, se puede minimizar y quitar) ---------- */
const CRWK = "pioneerCrWin";
let crW = null, crWs = { x: -1, y: -1, h: 0, m: 0 };
try { const sv = JSON.parse(localStorage.getItem(CRWK) || "null"); if (sv) Object.assign(crWs, sv); } catch (e) { }
crWs.m = 1;   /* al cargar siempre minimizada: asi nunca tapa los EQ */
function crWSave() {
    try { localStorage.setItem(CRWK, JSON.stringify(crWs)); } catch (e) { }
}
function crWPlace() {
    if (!crW)
        return;
    const w = crW.offsetWidth || 600, h = crW.offsetHeight || 200;
    let x = crWs.x, y = crWs.y;
    if (x < 0 || y < 0) { x = Math.max(8, innerWidth - w - 16); y = 80; }
    x = Math.min(Math.max(8, x), Math.max(8, innerWidth - w - 8));
    y = Math.min(Math.max(8, y), Math.max(8, innerHeight - Math.min(h, 120) - 8));
    crW.style.left = x + "px";
    crW.style.top = y + "px";
}
function crEl(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; }
function crWMake() {
    if (crW)
        return;
    crW = crEl("div", "crw");
    crW.setAttribute("role", "dialog");
    crW.setAttribute("aria-label", "Crossover y Procesador");
    const hd = crEl("div", "crh"), tt = crEl("b", "", "\ud83c\udf9b\ufe0f CROSSOVER Y PROCESADOR"), mn = crEl("button", "", "\u2013"), xx = crEl("button", "", "\u2715"), body = crEl("div", "crbody");
    mn.type = xx.type = "button";
    mn.title = "Minimizar"; mn.setAttribute("aria-label", "Minimizar");
    xx.title = "Quitar de la pantalla"; xx.setAttribute("aria-label", "Quitar de la pantalla");
    const bx = crEl("div");
    bx.id = "crxs";
    body.appendChild(bx);
    hd.append(tt, mn, xx);
    crW.append(hd, body);
    document.body.appendChild(crW);
    tt.style.cursor = "pointer";
    tt.onclick = () => mn.onclick();
    mn.onclick = () => { crWs.m = crWs.m ? 0 : 1; crW.classList.toggle("min", !!crWs.m); crWSave(); };
    xx.onclick = () => { crWs.h = 1; crWSave(); crWSync(); const b = $("crwt"); if (b) b.textContent = "Mostrar ventana"; };
    let dr = null;
    hd.addEventListener("pointerdown", e => {
        if (e.target.closest("button"))
            return;
        dr = { id: e.pointerId, dx: e.clientX - crW.offsetLeft, dy: e.clientY - crW.offsetTop };
        try { hd.setPointerCapture(e.pointerId); } catch (x) { }
        crW.classList.add("drag");
    });
    hd.addEventListener("pointermove", e => {
        if (!dr || dr.id !== e.pointerId)
            return;
        crWs.x = e.clientX - dr.dx;
        crWs.y = e.clientY - dr.dy;
        crWPlace();
    });
    const end = e => {
        if (dr && dr.id === e.pointerId) {
            dr = null;
            crW.classList.remove("drag");
            crWs.x = crW.offsetLeft; crWs.y = crW.offsetTop;
            crWSave();
        }
    };
    hd.addEventListener("pointerup", end);
    hd.addEventListener("pointercancel", end);
    addEventListener("resize", crWPlace);
}
function crWSync() {
    crWMake();
    const sh = crx.length > 0 && !crWs.h;
    crW.classList.toggle("show", sh);
    crW.classList.toggle("min", !!crWs.m);
    if (sh)
        crWPlace();
}
function crWToggle() {
    crWs.h = crWs.h ? 0 : 1;
    if (!crWs.h)
        crWs.m = 0;
    crWSave();
    crWSync();
}

const CRNOM = { x: "CROSSOVER", p: "PROCESSOR" };

function crCtl() {
    ["x", "p"].forEach(t => {
        const n = $("crn_" + t), a = $("cra_" + t), m = $("crm_" + t);
        if (n) n.textContent = crCnt(t) + "/" + CRMAX;
        if (a) a.disabled = crCnt(t) >= CRMAX;
        if (m) m.disabled = crCnt(t) <= 0;
    });
    crWSync();
    const wt = $("crwt");
    if (wt) {
        wt.disabled = !crx.length;
        wt.textContent = crWs.h ? "Mostrar ventana" : "Ocultar ventana";
    }
}

function crAdd(t) {
    if (!cro) {
        croOpen();
        return;
    }
    if (crCnt(t) >= CRMAX)
        return;
    /* solo se usa uno: si hay del otro tipo, se cambia por este */
    const ot = t === "x" ? "p" : "x";
    while (crCnt(ot) > 0)
        crRm(ot);
    crMk(null, t);
    crWs.h = 0; crWSave();
    crSave(); crCtl();
    if (typeof busGain === "function") busGain();
    if (on) ov(CRNOM[t] + " " + crCnt(t) + " ADDED");
}

function crRm(t) {
    let j = -1;
    crx.forEach((u, i) => { if (u.t === t) j = i; });
    if (j < 0)
        return;
    const u = crx.splice(j, 1)[0];
    if (u.nodes) {
        try { u.nodes.out.disconnect(); } catch (e) { }
        try { eqBus.disconnect(u.nodes.in); } catch (e) { }
    }
    u.el.remove();
    croWire();
    crSave(); crCtl();
    if (typeof busGain === "function") busGain();
    if (on) ov(CRNOM[t] + " " + (crCnt(t) + 1) + " REMOVED");
}

/* Con pase se muestran las unidades guardadas; sin pase se quitan (lo guardado se conserva por si lo vuelves a comprar). */
function crRender() {
    crWMake();
    crClear();
    if (cro)
        (crSaved || crLoad()).slice(0, CRMAX).forEach(x => crMk(x));
    crCtl();
}

/* La cuenta (servidor) manda: la llama cuenta.js al entrar y cada vez que consulta el perfil. */
function croSync(v, code) {
    v = !!v;
    const was = cro;
    cro = v;
    try {
        if (v) {
            localStorage.setItem("pioneerCRO", "1");
            if (code && !localStorage.getItem("pioneerCROcode"))
                localStorage.setItem("pioneerCROcode", code.length === 10 ? vfmt(code) : code);
        }
        else {
            localStorage.removeItem("pioneerCRO");
            localStorage.removeItem("pioneerCROcode");
        }
    }
    catch (e) { }
    if (was !== cro) {
        crRender();
        const m = $("crom");
        if (m && m.classList.contains("show"))
            croOpen();
    }
}

/* ---------- Ventana del pase ---------- */
function croClose() {
    $("crom").classList.remove("show");
}

function croGrant(code, fresh) {
    crnew = !!fresh;
    cro = true;
    try {
        localStorage.setItem("pioneerCRO", "1");
        localStorage.setItem("pioneerCROcode", code);
    }
    catch (e) { }
    crRender();
    croOpen();
}

function croCodeBox(c) {
    let k = "";
    try { k = localStorage.getItem("pioneerCROcode") || ""; } catch (e) { }
    if (!k)
        return;
    const b = mkEl("div", "vcb" + (crnew ? " new" : "")), cp = mkEl("button", "", "Copiar");
    cp.onclick = () => { try { navigator.clipboard.writeText(k); cp.textContent = "Copiado"; } catch (e) { } };
    b.append(mkEl("div", "", crnew ? "\u2705 \u00a1Pago recibido! Guarda tu c\u00f3digo de Crossover y Procesador:" : "Tu c\u00f3digo de Crossover y Procesador:"), mkEl("b", "", k), cp);
    c.appendChild(b);
    crnew = false;
}

function croOpen() {
    let m = $("crom");
    if (!m) {
        m = mkEl("div", "vm");
        m.id = "crom";
        m.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") croClose(); });
        m.addEventListener("pointerdown", e => { if (e.target === m) croClose(); });
        document.body.appendChild(m);
    }
    m.textContent = "";
    const c = mkEl("div", "vc"), x = mkEl("button", "vx", "\u2715");
    x.onclick = croClose;
    m.appendChild(c);
    c.append(x, mkEl("h2", "kit", "\ud83c\udf9b\ufe0f Crossover y Procesador"), mkEl("p", "vs", "Dos equipos que funcionan como un EQ pero cuidan m\u00e1s la calidad de la salida. Pago \u00fanico"));
    /* Panel para elegir cu\u00e1l usar: Crossover o Procesador (son dos equipos distintos) */
    const tabs = mkEl("div", "vtabs"), info = mkEl("div");
    const INF = {
        x: ["\ud83c\udf9a\ufe0f Crossover de 24 dB: FRONT y REAR pasa-altos y SUB pasa-bajos, que suman plano", "\ud83d\udd0a Sub con BASS BOOST +12 dB, PHASE 0\u00b0/180\u00b0 y MODE STEREO/MONO", "\ud83d\udd00 FREQUENCY MULTIPLIER (X1/X20) y PARALLEL INPUT (IN/CUT)"],
        p: ["\u2728 Procesador de audio: mejora la calidad de la salida sin sonar m\u00e1s fuerte", "\ud83c\udf9b\ufe0f SUBSONIC, BASS ENH, CLARITY, LOUDNESS, WIDTH (ancho est\u00e9reo), COMPRESSOR y OUTPUT", "\ud83d\udcca Pantalla LCD con medidor de salida y limitador para que no sature"]
    };
    const pick = t => {
        crSel = t;
        [...tabs.children].forEach((b, i) => b.classList.toggle("on", ["x", "p"][i] === t));
        info.textContent = "";
        const ul = mkEl("ul");
        INF[t].forEach(x => ul.appendChild(mkEl("li", "", x)));
        info.appendChild(ul);
        if (cro) {
            const row = mkEl("div", "eqc"), mm = mkEl("button", "", "\u2212"), mn = mkEl("b", "", crCnt(t) + "/" + CRMAX), mp = mkEl("button", "", "+");
            mm.id = "crm_" + t; mn.id = "crn_" + t; mp.id = "cra_" + t;
            mm.type = mp.type = "button";
            mm.setAttribute("aria-label", "Quitar " + (t === "p" ? "Procesador" : "Crossover"));
            mp.setAttribute("aria-label", "Agregar " + (t === "p" ? "Procesador" : "Crossover"));
            mm.onclick = () => crRm(t);
            mp.onclick = () => crAdd(t);
            row.append(mm, mn, mp);
            info.append(row, mkEl("p", "vs", "Solo puedes usar UNO: Crossover o Procesador. Si agregas este, se quita el otro. Se suma a la salida. Doble clic en una perilla la deja como estaba."));
            const wt = mkEl("button", "vchip", crWs.h ? "Mostrar ventana" : "Ocultar ventana");
            wt.id = "crwt"; wt.type = "button";
            wt.onclick = crWToggle;
            info.appendChild(wt);
            info.appendChild(mkEl("p", "vs", "Los equipos salen en una ventana que puedes mover arrastrando su barra, minimizar con \u2013 o quitar con \u2715. Se vuelve a abrir desde aqu\u00ed."));
            crCtl();
        }
    };
    [["x", "\ud83c\udf9a\ufe0f Crossover"], ["p", "\u2728 Procesador"]].forEach(a => {
        const b = mkEl("button", "vtab", a[1]);
        b.type = "button";
        b.onclick = () => pick(a[0]);
        tabs.appendChild(b);
    });
    c.append(mkEl("div", "vh", "ELIGE QU\u00c9 USAR"), tabs, info);
    pick(crSel);
    const pr = mkEl("div", "vprice");
    pr.append(document.createTextNode("$" + (window.RD_CRO_PRECIO || 5) + " "), mkEl("small", "", "USD \u00b7 pago \u00fanico"));
    c.appendChild(pr);
    if (cro) {
        croCodeBox(c);
    }
    else {
        const pay = mkEl("button", "vpay", "Pagar con PayPal"), or = mkEl("div", "vor", "\u00bfYa pagaste? Escribe tu c\u00f3digo de Crossover y Procesador"), row = mkEl("div", "vcode"), inp = mkEl("input"), ok = mkEl("button", "", "Desbloquear"), msg = mkEl("div");
        msg.className = "vmsg";
        inp.placeholder = "CP-XXXX-XXXX";
        inp.maxLength = 14;
        inp.autocomplete = "off";
        pay.onclick = () => {
            const u = window.RD_PAYPAL || "";
            if (!u || u.indexOf("TU_USUARIO") >= 0) { msg.textContent = "El pago a\u00fan no est\u00e1 configurado."; return; }
            window.open(u, "_blank", "noopener");
        };
        const go = () => {
            const k = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (cvalid(k))
                vsrv(k, "cro").then(er => er ? (msg.textContent = er) : croGrant(vfmt(k), false));
            else
                msg.textContent = "C\u00f3digo incorrecto.";
        };
        ok.onclick = go;
        inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        row.append(inp, ok);
        const ppb = mkEl("div"), use = vppLoad(ppb, msg, "Pioneer Radio Crossover y Procesador", cd => croGrant(vfmt(cd), true), "cro") ? ppb : pay;
        c.appendChild(mkEl("div", "vh", "DESBLOQUEA"));
        c.append(vGate(use), mkEl("p", "vs", "Al pagar, tu c\u00f3digo aparece aqu\u00ed al instante y se desbloquea solo. El pase se liga a tu cuenta."), or, row, msg);
    }
    m.classList.add("show");
}

{
    $("crob") && $("crob").addEventListener("click", croOpen);
    $("croo") && $("croo").addEventListener("click", croOpen);
    crWMake();
    crSaved = crLoad();
    crRender();
}

;
/**
 * Protecciones
 * Bloquea clic derecho, arrastrar y atajos de inspección.
 */

let nopeT = null;

function nopeMsg() {
    let el = $("nope");
    if (!el) {
        el = document.createElement("div");
        el.id = "nope";
        el.className = "nope";
        el.textContent = "ta bobo si te lo quieres robar 😎";
        document.body.appendChild(el);
    }
    el.classList.add("show");
    clearTimeout(nopeT);
    nopeT = setTimeout(() => el.classList.remove("show"), 2200);
}

addEventListener("contextmenu", e => {
    e.preventDefault();
    nopeMsg();
}, true);

addEventListener("dragstart", e => e.preventDefault(), true);

addEventListener("keydown", e => {
    const k = (e.key || "").toLowerCase(), c = e.ctrlKey || e.metaKey;
    const bad = e.key === "F12" || (c && e.shiftKey && ["i", "j", "c", "k"].includes(k)) || (c && !e.shiftKey && ["u", "s"].includes(k)) || (e.metaKey && e.altKey && ["i", "j", "c", "u"].includes(k));
    if (bad) {
        e.preventDefault();
        e.stopPropagation();
        nopeMsg();
    }
}, true);

;
/**
 * Avisos emergentes: los mensajes de error (de cuenta, equipos, pases, pagos, códigos...) ya no salen debajo del texto:
 * salen en un anuncio que aparece arriba, encima de todas las ventanas, y se va solo.
 * Los textos viejos (.acerr / .vmsg) siguen existiendo pero ocultos; cada vez que cambian se muestran aquí.
 */

(() => {
    const SEL = ".acerr,.vmsg,#vmsg";
    let box = null, last = "", lastT = 0;
    const INFO = /^(Verificando|Procesando|Guardando|Subiendo|Cargando)/i;

    function aviso(texto, tipo) {
        texto = String(texto || "").trim();
        if (!texto)
            return;
        const ahora = Date.now();
        if (texto === last && ahora - lastT < 900)
            return;
        last = texto; lastT = ahora;
        if (!box) {
            box = document.createElement("div");
            box.className = "avs";
            box.setAttribute("aria-live", "assertive");
            document.body.appendChild(box);
        }
        const t = document.createElement("div"), x = document.createElement("button");
        t.className = "av " + (tipo === "info" ? "info" : "err");
        t.setAttribute("role", "alert");
        const i = document.createElement("i"), p = document.createElement("span");
        i.textContent = tipo === "info" ? "ℹ️" : "⚠️";
        p.textContent = texto;
        x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Cerrar aviso");
        const quitar = () => { t.classList.add("out"); setTimeout(() => t.remove(), 250); };
        x.onclick = quitar;
        t.append(i, p, x);
        box.appendChild(t);
        while (box.children.length > 3)
            box.firstChild.remove();
        setTimeout(quitar, tipo === "info" ? 2500 : texto.length > 90 ? 11000 : 5500);
    }
    window.rdAviso = aviso;

    function mira(el) {
        if (!el || !el.matches || !el.matches(SEL))
            return;
        if (el.classList.contains("ok"))
            return;   /* los mensajes de éxito se quedan donde estaban */
        const t = (el.textContent || "").trim();
        if (t)
            aviso(t, INFO.test(t) ? "info" : "err");
    }

    new MutationObserver(rs => {
        rs.forEach(r => {
            if (r.type === "characterData")
                mira(r.target.parentElement && r.target.parentElement.closest(SEL));
            else {
                mira(r.target.closest && r.target.closest(SEL));
                r.addedNodes.forEach(n => { if (n.nodeType === 1) { mira(n); n.querySelectorAll && n.querySelectorAll(SEL).forEach(mira); } });
            }
        });
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
})();

;
/**
 * Voltímetro
 * Display de 7 segmentos que baja con los graves y sube con "Más voltaje".
 */

const VSEG = { 0: "abcdef", 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg" };
const vmEls = [];
let vmV = 12.6, vmBase = 12.6, vmBuf = null, vmShown = "";

function vmBuild() {
    const W = 28, H = 50, T = 6, G = 1.6, NS = "http://www.w3.org/2000/svg";
    const hz = (x1, x2, y) => [[x1, y], [x1 + T / 2, y - T / 2], [x2 - T / 2, y - T / 2], [x2, y], [x2 - T / 2, y + T / 2], [x1 + T / 2, y + T / 2]];
    const vt = (x, y1, y2) => [[x, y1], [x + T / 2, y1 + T / 2], [x + T / 2, y2 - T / 2], [x, y2], [x - T / 2, y2 - T / 2], [x - T / 2, y1 + T / 2]];
    const shapes = { a: hz(T / 2 + G, W - T / 2 - G, T / 2), g: hz(T / 2 + G, W - T / 2 - G, H / 2), d: hz(T / 2 + G, W - T / 2 - G, H - T / 2),
        f: vt(T / 2, T / 2 + G, H / 2 - G), b: vt(W - T / 2, T / 2 + G, H / 2 - G), e: vt(T / 2, H / 2 + G, H - T / 2 - G), c: vt(W - T / 2, H / 2 + G, H - T / 2 - G) };
    const svg = $("vms"), g = document.createElementNS(NS, "g");
    g.setAttribute("transform", "translate(8,1) skewX(-6)");
    svg.appendChild(g);
    [0, 34, 76].forEach(ox => {
        const d = {};
        for (const k in shapes) {
            const el = document.createElementNS(NS, "polygon");
            el.setAttribute("points", shapes[k].map(q => (q[0] + ox) + "," + q[1]).join(" "));
            el.setAttribute("class", "vo");
            g.appendChild(el);
            d[k] = el;
        }
        vmEls.push(d);
    });
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", 68);
    dot.setAttribute("cy", H - 3);
    dot.setAttribute("r", 3.2);
    dot.setAttribute("class", "vl");
    g.appendChild(dot);
}

function vmShow(str) {
    if (str === vmShown)
        return;
    vmShown = str;
    [str[0], str[1], str[3]].forEach((ch, i) => {
        const on = VSEG[ch] || "";
        for (const k in vmEls[i])
            vmEls[i][k].setAttribute("class", on.indexOf(k) >= 0 ? "vl" : "vo");
    });
}

function vmTick() {
    let bass = 0;
    if (eqNodes && !A.paused) {
        const an = eqNodes.an;
        if (!vmBuf || vmBuf.length !== an.frequencyBinCount)
            vmBuf = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(vmBuf);
        const n = Math.max(3, Math.round(150 / (AC.sampleRate / an.fftSize)));
        let sum = 0;
        for (let i = 1; i <= n; i++)
            sum += vmBuf[i];
        bass = sum / n / 255;
    }
    const target = vmBase - 2.2 * Math.pow(bass, 1.5) + (Math.random() - .5) * .05;
    vmV += (target - vmV) * (target < vmV ? .6 : .12);
    const x = Math.min(99.9, Math.max(0, vmV)).toFixed(1);
    vmShow((x.length < 4 ? " " : "") + x);
}

vmBuild();
vmShow("12.6");
setInterval(vmTick, 90);

;
/**
 * Color de la caja
 * Selector de color de la caja del radio.
 */

const CASECOL = [["Rojo", "#ff2d2d"], ["Azul", "#1f6bff"], ["Verde", "#1fc24a"], ["Naranja", "#ff8a1f"], ["Amarillo", "#f5d90a"], ["Rosa", "#ff3fa4"], ["Blanco", "#ececec"], ["Negro", "#1b1b1c"]];
let caseCol = "#ff2d2d";

function setCase(c, save) {
    caseCol = c;
    $("case").style.setProperty("--cc", c);
    [...$("sw2").querySelectorAll("button")].forEach((b, j) => b.classList.toggle("on", CASECOL[j][1] === c));
    const pk = $("sw2").querySelector(".cpk");
    if (pk)
        pk.classList.toggle("on", !CASECOL.some(x => x[1] === c));
    if (save) {
        try {
            localStorage.setItem("pioneerCase", c);
        }
        catch (e) { }
    }
}

CASECOL.forEach(c => {
    const b = document.createElement("button");
    b.style.background = c[1];
    b.title = c[0];
    b.onclick = () => setCase(c[1], true);
    $("sw2").appendChild(b);
});

{
    const l = document.createElement("label");
    l.className = "cpk";
    l.title = "Color personalizado";
    const i = document.createElement("input");
    i.type = "color";
    i.value = "#ff2d2d";
    i.oninput = () => setCase(i.value, true);
    l.appendChild(i);
    $("sw2").appendChild(l);
}

try {
    const c = localStorage.getItem("pioneerCase");
    if (/^#[0-9a-f]{6}$/i.test(c || ""))
        setCase(c);
}
catch (e) { }

setCase(caseCol);

;
/**
 * Imágenes de los chucheros (datos)
 * Cuatro chucheros (6, 8, 10 y 12), como archivos en assets/img.
 * Con http(s) se usan estos .webp; con doble click (file://) bocina.js carga la copia assets/img/chuchero-N.js.
 * SPKM guarda el tamaño de cada imagen y la posición de cada bocina (b = bajo/woofer, t = tweeter).
 */

const SPKIMGS = {
    6: "assets/img/chuchero-6.webp",
    8: "assets/img/chuchero-8.webp",
    10: "assets/img/chuchero-10.webp",
    12: "assets/img/chuchero-12.webp"
};

const SPKM = {"6":{"w":277,"h":705,"d":[{"k":"b","x":138,"y":140,"r":116,"c":58},{"k":"b","x":138,"y":562,"r":116,"c":58},{"k":"t","x":139,"y":351,"r":67,"c":30}]},"8":{"w":336,"h":825,"d":[{"k":"b","x":168,"y":169,"r":141,"c":70},{"k":"b","x":168,"y":654,"r":141,"c":70},{"k":"t","x":98,"y":412,"r":67,"c":30},{"k":"t","x":240,"y":412,"r":67,"c":30}]},"10":{"w":386,"h":947,"d":[{"k":"b","x":193,"y":194,"r":162,"c":81},{"k":"b","x":193,"y":751,"r":162,"c":81},{"k":"t","x":107,"y":475,"r":67,"c":30},{"k":"t","x":281,"y":475,"r":67,"c":30}]},"12":{"w":502,"h":1176,"d":[{"k":"b","x":251,"y":253,"r":211,"c":106},{"k":"b","x":251,"y":921,"r":211,"c":106},{"k":"t","x":107,"y":588,"r":67,"c":30},{"k":"t","x":249,"y":588,"r":67,"c":30},{"k":"t","x":391,"y":588,"r":67,"c":30}]}};

;
/**
 * Bajos (cajones de sonido), en orden de categoría: del más chico al más grande.
 * w y h son las medidas de cada imagen (assets/img/bajos/ID.webp); BAJOS_K las escala al tamaño en pantalla.
 */
const BAJOS = [
    { id: "12", nom: "12", w: 520, h: 917 },
    { id: "15", nom: "15", w: 581, h: 1023 },
    { id: "2-15", nom: "2-15", w: 1159, h: 1023 },
    { id: "3-15", nom: "3-15", w: 1739, h: 1023 },
    { id: "2-18", nom: "2-18", w: 1313, h: 680 },
    { id: "2-21", nom: "2-21", w: 1453, h: 752 }
];
const BAJOS_K = .28;

;
/**
 * Tablas (datos)
 * Tres tipos de tabla (con su marco negro, como en el dise\u00f1o), cada uno en tamaños de 6, 8, 10 y 12 pulgadas. Máximo 4 de cada tipo y tamaño.
 * Las de 6 son gratis; las de 8, 10 y 12 son del pase "Kitipo y Bajos".
 * TBLM guarda el tamaño de cada imagen y la posición de cada driver (b = woofer, t = tweeter).
 * El tamaño en pantalla sale del woofer: una tabla de N pulgadas tiene el woofer del mismo tamaño que el chuchero de N.
 */

const TBLIMGS = {
    1: "assets/img/tablas/tipo1.webp",
    2: "assets/img/tablas/tipo2.webp",
    3: "assets/img/tablas/tipo3.webp"
};
const TBLSIZES = [6, 8, 10, 12], TBLMAX = 4, TBLRW = 176;
const TBLNOM = { 1: "Tipo 1", 2: "Tipo 2", 3: "Tipo 3" };
const TBLDES = { 1: "3 tablas: woofer + tweeter, woofer, tweeter + woofer", 2: "4 woofers apilados", 3: "2 woofers, 2 tweeters y 2 woofers" };
const TW = (x, y) => ({ k: "b", x, y, r: TBLRW, c: 88 }), TT = (x, y) => ({ k: "t", x, y, r: 104, c: 46 });
const TBLM = {
    1: { w: 506, h: 1946, d: [TW(251, 255), TT(254, 581), TW(251, 973), TT(254, 1377), TW(251, 1702)] },
    2: { w: 507, h: 1946, d: [TW(251, 255), TW(249, 727), TW(249, 1206), TW(249, 1690)] },
    3: { w: 537, h: 1946, d: [TW(271, 246), TW(271, 646), TT(157, 975), TT(386, 975), TW(265, 1306), TW(265, 1706)] }
};

;
/**
 * Chucheros animados
 * Dibuja el chuchero (6, 8, 10 o 12) en canvas, recolorea el azul y mueve los conos según graves/agudos.
 * Por defecto va el de 6; los demás se desbloquean con el pase "Kitipo y Bajos" (js/vip/kitipo.js).
 */

const SPKCOL = [["Original", "#0f70b7"]].concat(CASECOL);
const SPKREF = 185;
let spkSize = 6, spkCol = SPKCOL[0][1], spkBuf = null, spkStack = [6];
const spkL = { b: 0, m: 0, t: 0 }, SPKR = {}, SPKU = [], SPKMAX = { 6: 2, 8: 4, 10: 2, 12: 3 };
/* Tablas (js/data/tablas.js): lista de [tipo, tama\u00f1o]. drvCol = color de los drivers (null = original). */
const TBU = [], TBR = {}, SPKBR = { 6: 115, 8: 139, 10: 173, 12: 225 };   /* radio real del woofer (canasto) de cada chuchero */
let tbStack = [], drvCol = null;
/* Orden \u00fanico de la fila, de izquierda a derecha: "s" = chuchero, "t" = tabla (el k-\u00e9simo "s" es spkStack[k], el k-\u00e9simo "t" es tbStack[k]). */
let rowOrd = [];

/* Un "renderizador" por tamaño de chuchero: imagen, copia recoloreada y estado de carga (se comparte entre los iguales). */
function spkR(n) {
    return SPKR[n] || (SPKR[n] = { n, im: new Image(), src: null, rec: null, js: "assets/img/chuchero-" + n + ".js", g: "SPKB", url: SPKIMGS[n] });
}

function tbR(t) {
    return TBR[t] || (TBR[t] = { n: t, im: new Image(), src: null, rec: null, js: "assets/img/tablas/tipo" + t + ".js", g: "TBLB", url: TBLIMGS[t] });
}

function spkRecolor(r, hex) {
    const spkIm = r && r.im;
    if (!spkIm || !spkIm.complete || !spkIm.naturalWidth)
        return;
    const W = spkIm.naturalWidth, H = spkIm.naturalHeight;
    if (!r.src) {
        const o = document.createElement("canvas");
        o.width = W;
        o.height = H;
        const c = o.getContext("2d");
        c.drawImage(spkIm, 0, 0);
        r.src = c.getImageData(0, 0, W, H);
    }
    if (!r.rec) {
        r.rec = document.createElement("canvas");
        r.rec.width = W;
        r.rec.height = H;
    }
    const T = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const d = new Uint8ClampedArray(r.src.data);
    const D = drvCol && /^#[0-9a-f]{6}$/i.test(drvCol) ? [parseInt(drvCol.slice(1, 3), 16), parseInt(drvCol.slice(3, 5), 16), parseInt(drvCol.slice(5, 7), 16)] : null;
    for (let p = 0; p < d.length; p += 4) {
        const r = d[p], g = d[p + 1], b = d[p + 2];
        if (D && d[p + 3] > 0 && !(b > r + 30 && b > g * 1.08)) {
            /* driver: el cono blanco y el canasto gris toman el color; lo oscuro (tapa, bordes) y los tornillos rojos no */
            const L = (r + g + b) / 3;
            if (Math.max(r, g, b) - Math.min(r, g, b) < 46 && L > 75) {
                const w = Math.min(1, (L - 75) / 40), k = Math.min(1.05, L / 238);
                d[p] += (Math.min(255, D[0] * k) - r) * w;
                d[p + 1] += (Math.min(255, D[1] * k) - g) * w;
                d[p + 2] += (Math.min(255, D[2] * k) - b) * w;
            }
        }
        else if (d[p + 3] > 0 && b > r + 30 && b > g * 1.08) {
            const sat = (b - r) / b, w = Math.min(1, (sat - .25) / .3);
            if (w > 0) {
                const k = Math.min(1.12, b / SPKREF);
                d[p] += (Math.min(255, T[0] * k) - r) * w;
                d[p + 1] += (Math.min(255, T[1] * k) - g) * w;
                d[p + 2] += (Math.min(255, T[2] * k) - b) * w;
            }
        }
    }
    r.rec.getContext("2d").putImageData(new ImageData(d, W, H), 0, 0);
    SPKU.forEach(u => u.dirty = u.sd = true);
    TBU.forEach(u => u.dirty = u.sd = true);
}

function setSpk(c, save) {
    spkCol = c;
    const row = $("sw3");
    [...row.querySelectorAll("button")].forEach((b, j) => b.classList.toggle("on", SPKCOL[j][1] === c));
    const pk = row.querySelector(".cpk");
    if (pk)
        pk.classList.toggle("on", !SPKCOL.some(x => x[1] === c));
    Object.keys(SPKR).forEach(n => spkRecolor(SPKR[n], c));
    Object.keys(TBR).forEach(n => spkRecolor(TBR[n], c));
    if (typeof bajoPaint === "function")
        bajoPaint();
    if (save) {
        try {
            localStorage.setItem("pioneerSpk2", c);
        }
        catch (e) { }
    }
}

SPKCOL.forEach(c => {
    const b = document.createElement("button");
    b.style.background = c[1];
    b.title = c[0];
    b.onclick = () => setSpk(c[1], true);
    $("sw3").appendChild(b);
});

{
    const l = document.createElement("label");
    l.className = "cpk";
    l.title = "Color personalizado";
    const i = document.createElement("input");
    i.type = "color";
    i.value = "#0f70b7";
    i.oninput = () => setSpk(i.value, true);
    l.appendChild(i);
    $("sw3").appendChild(l);
}

/* Color de los drivers (conos y canastos de chucheros y tablas). Original = sin cambio. */
function setDrv(c, save) {
    drvCol = c && /^#[0-9a-f]{6}$/i.test(c) ? c : null;
    const row = $("sw4");
    [...row.querySelectorAll("button")].forEach((b, j) => b.classList.toggle("on", (j ? SPKCOL[j - 1][1] : null) === drvCol));
    const pk = row.querySelector(".cpk");
    if (pk)
        pk.classList.toggle("on", !!drvCol && !SPKCOL.some(x => x[1] === drvCol));
    Object.keys(SPKR).forEach(n => spkRecolor(SPKR[n], spkCol));
    Object.keys(TBR).forEach(n => spkRecolor(TBR[n], spkCol));
    if (save) {
        try {
            localStorage.setItem("pioneerDrv", drvCol || "");
        }
        catch (e) { }
    }
}

{
    const row = $("sw4");
    [["Original", null]].concat(SPKCOL).forEach(c => {
        const b = document.createElement("button");
        b.type = "button";
        b.title = c[0];
        if (c[1])
            b.style.background = c[1];
        else {
            b.style.background = "linear-gradient(135deg,#f5f5f3 50%,#bdbdbd 50%)";
            b.textContent = "";
        }
        b.onclick = () => setDrv(c[1], true);
        row.appendChild(b);
    });
    const l = document.createElement("label");
    l.className = "cpk";
    l.title = "Color personalizado";
    const i = document.createElement("input");
    i.type = "color";
    i.value = "#d62828";
    i.oninput = () => setDrv(i.value, true);
    l.appendChild(i);
    row.appendChild(l);
}

try {
    const dc = localStorage.getItem("pioneerDrv");
    if (/^#[0-9a-f]{6}$/i.test(dc || ""))
        drvCol = dc;
    setDrv(drvCol, false);
}
catch (e) { }

try {
    const c = localStorage.getItem("pioneerSpk2");
    if (/^#[0-9a-f]{6}$/i.test(c || ""))
        spkCol = c;
}
catch (e) { }

function spkRead() {
    let b = 0, m = 0, t = 0;
    if (typeof AC !== "undefined" && AC && eqNodes && !A.paused) {
        const an = eqNodes.an;
        if (!spkBuf || spkBuf.length !== an.frequencyBinCount)
            spkBuf = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(spkBuf);
        const hz = AC.sampleRate / an.fftSize, avg = (f1, f2) => {
            const i1 = Math.max(1, Math.round(f1 / hz)), i2 = Math.max(i1, Math.round(f2 / hz));
            let s = 0;
            for (let i = i1; i <= i2; i++)
                s += spkBuf[i];
            return s / (i2 - i1 + 1) / 255;
        };
        const nz = (x, o, sp) => Math.max(0, Math.min(1, (x - o) / sp));
        b = Math.pow(nz(avg(35, 150), .3, .5), 1.15);
        m = nz(avg(150, 2200), .25, .5);
        t = nz(avg(2500, 12000), .18, .45);
    }
    return { b, m, t };
}

/* Blur de pantalla: sale de la señal DESPUÉS de los ecualizadores y ANTES del compresor, así sube o baja
   cuando mueves los EQ y sigue los tonos de la música: graves (golpe), medios y agudos aportan menos. */
let bbAvg = 0, bbDrive = 0, bbBuf = null;

function bbLevel() {
    let b = 0, m = 0, t = 0;
    if (typeof AC !== "undefined" && AC && eqNodes && eqNodes.av && !A.paused) {
        const an = eqNodes.av;
        if (!bbBuf || bbBuf.length !== an.frequencyBinCount)
            bbBuf = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(bbBuf);
        const hz = AC.sampleRate / an.fftSize, avg = (f1, f2) => {
            const i1 = Math.max(1, Math.round(f1 / hz)), i2 = Math.max(i1, Math.round(f2 / hz));
            let s = 0;
            for (let i = i1; i <= i2; i++)
                s += bbBuf[i];
            return s / (i2 - i1 + 1) / 255;
        };
        const nz = (x, o, sp) => Math.max(0, Math.min(1, (x - o) / sp));
        b = nz(avg(35, 150), .55, .5);
        m = nz(avg(150, 2500), .5, .5);
        t = nz(avg(2500, 12000), .45, .5);
    }
    bbAvg += (b - bbAvg) * .02;
    const target = Math.min(1, b * .55 + Math.max(0, b - bbAvg) * 1.2 + m * .25 + t * .15);
    bbDrive += (target - bbDrive) * (target > bbDrive ? .6 : .12);
    if (bbDrive < .01)
        bbDrive = 0;
    return bbDrive;
}

/* Bajos (cajones): del más chico al más grande. Cuanto más grande la categoría, más mueve el blur y más sube el sub level. */
let bajoId = "", BASSX = 0, BLURX = 1;

function bajoLvl() {
    return typeof BAJOS !== "undefined" ? BAJOS.findIndex(b => b.id === bajoId) + 1 : 0;
}

/* Escala del chuchero: con bajo puesto, el chuchero se ve m\u00e1s chico que el bajo (el de 6 menor que el bajo de 12). */
const spkS = m => bajoId ? .72 * m.h / SPKM[12].h : .45 + .55 * m.h / SPKM[12].h;

/* Escala (relativa a --h0) de una tabla de tipo t y tama\u00f1o n: su altura es la misma que la del chuchero de n. */
function tbS(t, n) {
    const M = SPKM[n], m = TBLM[t];
    return spkS(M);   /* misma altura que el chuchero de n */
}

function spkFit() {
    const box = $("spk"), cs = getComputedStyle(box), h0 = parseFloat(cs.getPropertyValue("--h0")) || 360, kk = h0 / 360;
    const W = Math.min(box.clientWidth || window.innerWidth, window.innerWidth * .92);
    let sum = 0, hc = 0;
    SPKU.forEach(u => { const m = SPKM[u.n], h = h0 * spkS(m); sum += h * m.w / m.h - h0 * .012; hc = Math.max(hc, h); });
    TBU.forEach(u => { const m = TBLM[u.t], h = h0 * tbS(u.t, u.n); sum += h * m.w / m.h - h0 * .012; hc = Math.max(hc, h); });
    for (let i = 1; i < rowOrd.length; i++)
        if (rowOrd[i] !== rowOrd[i - 1])
            sum += h0 * .012;   /* sin espacio entre chuchero y tabla (0) m\u00e1s el solape que ya no hay (.012) */
    let need = sum, hb = 0;
    const bj = typeof BAJOS !== "undefined" && BAJOS.find(b => b.id === bajoId);
    if (bj) {
        need = Math.max(need, bj.w * BAJOS_K * kk);
        hb = bj.h * BAJOS_K * kk;
    }
    let f = Math.min(1, W / Math.max(1, need));
    if (cs.position === "fixed")
        f = Math.min(f, window.innerHeight * .9 / Math.max(1, hc + hb));
    box.style.setProperty("--f", Math.max(.2, f).toFixed(4));
}

function rowFix() {
    let ns = spkStack.length, nt = tbStack.length;
    const out = [];
    rowOrd.forEach(k => {
        if (k === "s" && ns > 0) { out.push(k); ns--; }
        else if (k === "t" && nt > 0) { out.push(k); nt--; }
    });
    while (ns-- > 0)
        out.push("s");
    while (nt-- > 0)
        out.push("t");
    rowOrd = out;
}

function rowSave() {
    try {
        localStorage.setItem("pioneerStack", JSON.stringify(spkStack));
        localStorage.setItem("pioneerSpkSize", spkStack[0]);
        localStorage.setItem("pioneerTabs", JSON.stringify(tbStack));
        localStorage.setItem("pioneerRow", JSON.stringify(rowOrd));
    }
    catch (e) { }
}

/* Lista de la fila con lo que es cada casilla (para el panel de orden). */
function rowItems() {
    rowFix();
    let a = 0, b = 0;
    return rowOrd.map(k => k === "s" ? { k, n: spkStack[a++] } : { k, t: tbStack[b][0], n: tbStack[b++][1] });
}

/* Quita la marca del idx-\u00e9simo elemento de ese tipo (al quitar un chuchero o una tabla). */
function rowDrop(kind, idx) {
    rowFix();
    let c = -1;
    const i = rowOrd.findIndex(x => x === kind && ++c === idx);
    if (i >= 0)
        rowOrd.splice(i, 1);
}

/* Mueve la casilla i una posici\u00f3n (d = -1 izquierda, 1 derecha). Chucheros y tablas se ordenan juntos. */
function rowMove(i, d) {
    rowFix();
    const j = i + d;
    if (i < 0 || j < 0 || i >= rowOrd.length || j >= rowOrd.length)
        return;
    const a = rowOrd[i], b = rowOrd[j];
    if (a === b) {
        const idx = q => rowOrd.slice(0, q + 1).filter(x => x === a).length - 1, x = idx(i), y = idx(j);
        const c = (a === "s" ? spkStack : tbStack).slice();
        [c[x], c[y]] = [c[y], c[x]];
        if (a === "s")
            spkStack = c;
        else
            tbStack = c;
    }
    else {
        rowOrd = rowOrd.slice();
        [rowOrd[i], rowOrd[j]] = [b, a];
    }
    spkBuild();
    rowSave();
}

/* Aplica un orden guardado solo si coincide con lo que hay (si no, queda el de siempre: chucheros y luego tablas). */
function rowSetOrd(list) {
    if (!Array.isArray(list))
        return;
    const s = list.filter(k => k === "s").length, t = list.filter(k => k === "t").length;
    if (s !== spkStack.length || t !== tbStack.length || s + t !== list.length)
        return;
    rowOrd = list.slice();
    spkBuild();
}

function spkBuild() {
    rowFix();
    const row = $("spkrow");
    row.textContent = "";
    SPKU.length = 0;
    TBU.length = 0;
    let a = 0, b = 0, prev = "";
    rowOrd.forEach(k => {
        const sep = prev && prev !== k;   /* entre un chuchero y una tabla queda un espacio */
        prev = k;
        if (k === "s") {
            const n = spkStack[a++], m = SPKM[n], cv = document.createElement("canvas");
            if (sep)
                cv.className = "sep";
            cv.width = m.w;
            cv.height = m.h;
            cv.setAttribute("aria-label", "Chuchero de " + n);
            cv.style.setProperty("--sc", spkS(m).toFixed(4));
            row.appendChild(cv);
            SPKU.push({ n, cv, cx: cv.getContext("2d"), dirty: true });
            spkLoadR(spkR(n));
        }
        else {
            /* las tablas van en la misma fila que los chucheros, apoyadas igual sobre el bajo */
            const [t, n] = tbStack[b++], m = TBLM[t], cv = document.createElement("canvas");
            if (sep)
                cv.className = "sep";
            cv.width = m.w;
            cv.height = m.h;
            cv.setAttribute("aria-label", "Tabla " + TBLNOM[t] + " de " + n);
            cv.style.setProperty("--sc", tbS(t, n).toFixed(4));
            row.appendChild(cv);
            TBU.push({ t, n, m, cv, cx: cv.getContext("2d"), dirty: true });
            spkLoadR(tbR(t));
        }
    });
    spkSize = spkStack[0] || 6;
    spkFit();
}

const tbBuild = () => spkBuild();

const tbCount = (t, n) => tbStack.filter(x => x[0] === t && x[1] === n).length;
const tbFree = n => n === 6 || typeof kitOK !== "function" || kitOK();

/* Cambiar el conjunto de tablas (lista de [tipo, tama\u00f1o]). M\u00e1ximo 4 por tipo y tama\u00f1o; solo las de 6 son gratis. */
function tbSet(list, save) {
    const cnt = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(x => {
        const t = +(x && x[0]), n = +(x && x[1]), k = t + "-" + n;
        if (!TBLM[t] || !SPKM[n] || !tbFree(n) || (cnt[k] || 0) >= TBLMAX)
            return;
        cnt[k] = (cnt[k] || 0) + 1;
        out.push([t, n]);
    });
    tbStack = out;
    tbBuild();
    if (save) {
        try {
            localStorage.setItem("pioneerTabs", JSON.stringify(tbStack));
            localStorage.setItem("pioneerRow", JSON.stringify(rowOrd));
        }
        catch (e) { }
    }
}

function tbAdd(t, n) {
    if (!TBLM[t] || !SPKM[n] || tbCount(t, n) >= TBLMAX || !tbFree(n))
        return false;
    tbSet(tbStack.concat([[t, n]]), true);
    return true;
}

function tbDel(t, n) {
    const i = tbStack.map(x => x[0] + "-" + x[1]).lastIndexOf(t + "-" + n);
    if (i < 0)
        return false;
    rowDrop("t", i);
    const a = tbStack.slice();
    a.splice(i, 1);
    tbSet(a, true);
    return true;
}

/* Cambiar el conjunto de chucheros (lista de tamaños). Respeta los máximos (con vacio=true se puede quedar sin chucheros). */
function spkSet(list, save, vacio) {
    const cnt = {}, out = [];
    (list || []).forEach(n => {
        n = +n;
        if (!SPKM[n] || (cnt[n] || 0) >= SPKMAX[n])
            return;
        cnt[n] = (cnt[n] || 0) + 1;
        out.push(n);
    });
    spkStack = out.length || vacio ? out : [6];
    spkBuild();
    if (save) {
        try {
            localStorage.setItem("pioneerStack", JSON.stringify(spkStack));
            localStorage.setItem("pioneerSpkSize", spkStack[0]);
            localStorage.setItem("pioneerRow", JSON.stringify(rowOrd));
        }
        catch (e) { }
    }
}

const spkCount = n => spkStack.filter(x => x === n).length;

function spkAdd(n) {
    if (spkCount(n) >= SPKMAX[n] || (n !== 6 && typeof kitOK === "function" && !kitOK()))
        return false;
    /* se apilan al lado de los demás, agrupados por tamaño */
    spkSet(spkStack.concat(n), true, true);
    return true;
}

function spkDel(n) {
    const i = spkStack.lastIndexOf(n);
    if (i < 0)
        return false;
    rowDrop("s", i);
    spkStack.splice(i, 1);
    spkSet(spkStack, true, true);
    return true;
}

/* Los bajos 2-18 y 2-21 tienen paneles azules: toman el mismo color que los chucheros (se cambia en Opciones). */
const BAJOTINT = ["2-18", "2-21"], BAJOI = {};

function bajoPaint() {
    const im = $("bsrow").firstChild;
    if (!im || BAJOTINT.indexOf(bajoId) < 0)
        return;
    const id = bajoId, url = "assets/img/bajos/" + id + ".webp";
    const go = o => {
        if (id !== bajoId || im.parentNode !== $("bsrow"))
            return;
        try {
            const W = o.naturalWidth, H = o.naturalHeight, c = document.createElement("canvas");
            c.width = W;
            c.height = H;
            const x = c.getContext("2d");
            x.drawImage(o, 0, 0);
            const g = x.getImageData(0, 0, W, H), d = g.data, hex = spkCol;
            const T = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
            for (let p = 0; p < d.length; p += 4) {
                const r = d[p], gg = d[p + 1], b = d[p + 2];
                if (d[p + 3] > 0 && b > r + 30 && b > gg * 1.08) {
                    const sat = (b - r) / b, w = Math.min(1, (sat - .25) / .3);
                    if (w > 0) {
                        const k = Math.min(1.12, b / SPKREF);
                        d[p] += (Math.min(255, T[0] * k) - r) * w;
                        d[p + 1] += (Math.min(255, T[1] * k) - gg) * w;
                        d[p + 2] += (Math.min(255, T[2] * k) - b) * w;
                    }
                }
            }
            x.putImageData(g, 0, 0);
            im.src = c.toDataURL("image/webp", .9);
        }
        catch (e) { }
    };
    const o = BAJOI[id];
    if (o && o.complete && o.naturalWidth)
        return go(o);
    const n = BAJOI[id] = new Image();
    n.onload = () => go(n);
    n.src = url;
}

function setBajo(id, save) {
    if (id && id !== "12" && typeof kitOK === "function" && !kitOK())
        id = "";
    bajoId = typeof BAJOS !== "undefined" && BAJOS.some(b => b.id === id) ? id : "";
    const lvl = bajoLvl(), row = $("bsrow");
    row.textContent = "";
    BASSX = lvl ? [1, 2, 3.5, 5, 6.5, 8][lvl - 1] : 0;
    BLURX = 1 + .15 * lvl;
    if (lvl) {
        const b = BAJOS[lvl - 1], im = document.createElement("img");
        im.src = "assets/img/bajos/" + b.id + ".webp";
        im.alt = "Bajo " + b.id;
        im.draggable = false;
        row.style.setProperty("--bh", (b.h * BAJOS_K).toFixed(1) + "px");
        row.appendChild(im);
        bajoPaint();
    }
    SPKU.forEach(u => u.cv.style.setProperty("--sc", spkS(SPKM[u.n]).toFixed(4)));
    TBU.forEach(u => u.cv.style.setProperty("--sc", tbS(u.t, u.n).toFixed(4)));
    spkFit();
    if (typeof AC !== "undefined" && AC && typeof applyAudio === "function")
        applyAudio();
    if (save) {
        try {
            localStorage.setItem("pioneerBajo", bajoId);
        }
        catch (e) { }
    }
}

/* Nitidez: el lienzo se ajusta al tama\u00f1o REAL en pantalla (por la densidad de p\u00edxeles) y la imagen se reduce por pasos,
   as\u00ed los bordes y las l\u00edneas finas no se ven dentados ni punteados cuando la imagen se muestra mucho m\u00e1s chica que el original. */
let spkTick = 0;

function spkSizeU(u) {
    const m = u.m || SPKM[u.n], ch = u.cv.clientHeight;
    if (!ch)
        return false;
    if (u.k && spkTick % 15)
        return false;
    const th = Math.max(16, Math.min(m.h, Math.round(ch * (window.devicePixelRatio || 1))));
    if (u.k && Math.abs(th - u.cv.height) <= 1)
        return false;
    u.k = th / m.h;
    u.cv.width = Math.max(1, Math.round(m.w * u.k));
    u.cv.height = th;
    u.sd = u.dirty = true;
    return true;
}

function spkScaled(u, r) {
    const W = u.cv.width, H = u.cv.height, q = (w, h) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        return c;
    };
    let cur = r.rec;
    while (cur.width / 2 > W && cur.height / 2 > H) {
        const c = q(Math.max(W, Math.ceil(cur.width / 2)), Math.max(H, Math.ceil(cur.height / 2)));
        c.getContext("2d").drawImage(cur, 0, 0, c.width, c.height);
        cur = c;
    }
    const f = q(W, H);
    f.getContext("2d").drawImage(cur, 0, 0, W, H);
    u.sc = f;
    u.sd = false;
}

function spkDraw(u, r) {
    const x = u.cx, m = u.m || SPKM[u.n], k = u.k || 1;
    if (u.sd || !u.sc || u.sc.width !== u.cv.width || u.sc.height !== u.cv.height)
        spkScaled(u, r);
    const src = u.sc;
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = "high";
    x.clearRect(0, 0, u.cv.width, u.cv.height);
    x.drawImage(src, 0, 0);
    for (const d0 of m.d) {
        const v = spkL[d0.k];
        if (v <= 0)
            continue;
        const d = { x: d0.x * k, y: d0.y * k, r: d0.r * k, c: d0.c * k };
        const big = d0.k === "b", s1 = 1 + v * (big ? .075 : .05), s2 = 1 + v * (big ? .16 : .11);
        const zoom = (R, s) => {
            x.save();
            x.beginPath();
            x.arc(d.x, d.y, R, 0, 6.2832);
            x.clip();
            x.translate(d.x, d.y);
            x.scale(s, s);
            x.translate(-d.x, -d.y);
            x.drawImage(src, 0, 0);
            x.restore();
        };
        zoom(d.r, s1);
        zoom(d.c, s2);
        const g = x.createRadialGradient(d.x, d.y, d.r * .55, d.x, d.y, d.r);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0," + (.34 * v) + ")");
        x.fillStyle = g;
        x.beginPath();
        x.arc(d.x, d.y, d.r, 0, 6.2832);
        x.fill();
        const h = x.createRadialGradient(d.x - d.c * .3, d.y - d.c * .3, 0, d.x, d.y, d.c);
        h.addColorStop(0, "rgba(255,255,255," + (.2 * v) + ")");
        h.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = h;
        x.beginPath();
        x.arc(d.x, d.y, d.c, 0, 6.2832);
        x.fill();
    }
}

let spkSalta = false;
function spkFrame() {
    requestAnimationFrame(spkFrame);
    if (spkSalta = !spkSalta) return;            /* 30 cuadros por segundo en vez de 60: se ve igual y pesa la mitad (menos lag en celulares) */
    const n = spkRead();
    const bp = blurOn ? Math.round(bbLevel() * 12 * BLURX / 2) * 2 / 5 : 0;   /* sin bajo: 0 a 2.4 px; con bajo, más según la categoría. Escalones de 0.4 px: cambia menos veces y no se traba */
    if (bp !== bbV) {
        bbV = bp;
        bb.style.backdropFilter = bb.style.webkitBackdropFilter = bp ? "blur(" + bp + "px)" : "none";
    }
    let act = false;
    for (const k in n) {
        const v = n[k];
        spkL[k] += (v - spkL[k]) * (v > spkL[k] ? .7 : .16);
        if (spkL[k] < .004) {
            spkL[k] = 0;
        }
        else
            act = true;
    }
    spkTick++;
    for (const u of SPKU) {
        const r = SPKR[u.n];
        if (!r || !r.rec)
            continue;
        const rs = spkSizeU(u);
        if (!(act || u.dirty || rs))
            continue;
        u.dirty = false;
        spkDraw(u, r);
    }
    for (const u of TBU) {
        const r = TBR[u.t];
        if (!r || !r.rec)
            continue;
        const rs = spkSizeU(u);
        if (!(act || u.dirty || rs))
            continue;
        u.dirty = false;
        spkDraw(u, r);
    }
}

/* El canvas necesita leer los píxeles del chuchero. Con http(s) se usa el archivo .webp; en una app (exe) o con doble
   click (file://) el navegador lo puede bloquear, y entonces se carga la copia assets/img/chuchero-N.js (misma imagen). */
let spkJs = location.protocol === "file:";

function spkViaJs(r) {
    const n = r.n, G = r.g, go = () => { if (window[G] && window[G][n]) r.im.src = window[G][n]; };
    if (window[G] && window[G][n])
        return go();
    const s = document.createElement("script");
    s.src = r.js;
    s.onload = go;
    document.head.appendChild(s);
}

function spkLoadR(r) {
    if (r.started)
        return;
    r.started = true;
    r.im.onerror = () => {
        if (!spkJs) {
            spkJs = true;
            spkViaJs(r);
        }
    };
    r.im.onload = () => {
        if (!spkJs && !spkReadable(r.im)) {
            spkJs = true;
            spkViaJs(r);
            return;
        }
        spkRecolor(r, spkCol);
        if (!spkRun) {
            spkRun = true;
            spkFrame();
        }
    };
    if (spkJs)
        spkViaJs(r);
    else
        r.im.src = r.url;
}

function spkReadable(im) {
    try {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const x = c.getContext("2d");
        x.drawImage(im, 0, 0, 1, 1);
        x.getImageData(0, 0, 1, 1);
        return true;
    }
    catch (e) {
        return false;
    }
}

/* Compatibilidad: deja un solo chuchero del tamaño n. */
function setSpkSize(n, save) {
    n = SPKM[n] ? +n : 6;
    spkSet([n], save);
}

let spkRun = false, bbV = 0, blurOn = true;
try { blurOn = localStorage.getItem("pioneerBlur") !== "0"; } catch (e) { }
/* Activa o desactiva el blur de pantalla (el que se mueve con los bajos). */
function setBlur(v, save) {
    blurOn = !!v;
    const b = document.getElementById("blurb");
    if (b) {
        b.classList.toggle("on", blurOn);
        b.setAttribute("aria-pressed", String(blurOn));
        b.textContent = blurOn ? "\uD83D\uDFE2 Blur: ENCENDIDO" : "\u26AA Blur: APAGADO";
    }
    if (!blurOn) { bbV = 0; bb.style.backdropFilter = bb.style.webkitBackdropFilter = "none"; }
    if (save) { try { localStorage.setItem("pioneerBlur", blurOn ? "1" : "0"); } catch (e) { } }
}
const bb = document.createElement("div");
bb.id = "bb";
document.body.appendChild(bb);

window.addEventListener("resize", spkFit);
spkSet([6]);

setBlur(blurOn, false);
$("blurb") && $("blurb").addEventListener("click", () => setBlur(!blurOn, true));

;
/**
 * Pantalla de carga
 * La animación (barra, porcentaje y mensajes) viene dentro de la imagen assets/img/carga.webp|gif.
 * Aquí solo se decide cuándo quitarla: cuando la imagen ya cargó y terminó una vuelta completa
 * (así nunca se corta a la mitad), con un tope por si la conexión es muy lenta.
 */

{
    const DURACION = 5860;   // ms: una vuelta completa de la animación (140 cuadros)
    const TOPE = 20000;      // ms: límite máximo de espera
    const img = $("ldimg");
    let quitada = false;

    const quitar = () => {
        if (quitada) return;
        quitada = true;
        const l = $("ld");
        if (!l) return;
        l.classList.add("out");
        setTimeout(() => l.remove(), 800);
    };

    // Empieza a contar cuando la imagen ya está lista (se ve desde el cuadro 1)
    const iniciar = () => setTimeout(quitar, DURACION);
    if (img && img.complete && img.naturalWidth) iniciar();
    else if (img) {
        img.addEventListener("load", iniciar);
        img.addEventListener("error", quitar);
    } else {
        quitar();
    }
    setTimeout(quitar, TOPE);
}

;
/**
 * Códigos de Personalización (hash)
 * Función hash y lista de códigos válidos.
 */

function h53(s) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, c; i < s.length; i++) {
        c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const VIPH = [1927934347031383, 71740044694863, 2068393105074724, 1780160709976528, 6755609213720710, 7475031130450706, 5202773563746623, 4293762986396927, 8943215130998821, 6750228676908690, 8548455359294571, 2269372936050071, 1658613011788616, 1135125257163978, 1712768307456137, 713093617047846, 2374056728110616, 1347815908189945, 5110558014843288, 2090657599339878, 2872651582710730, 6101125080284985, 3057596824599258, 7660392708131933, 7261224548402568, 4330325827112291, 2596795490221099, 7770563539147605, 5029863637390593, 1766706712966525];

;
/**
 * Modelos de radio (datos)
 * Posiciones de pantalla, perilla y botones de cada radio. Las imágenes están en assets/radios/.
 */

/* Cada modelo: imagen (src), proporción (ar), perilla (kb), pantalla (lcd), tapa de pantalla (cov),
   brillo (bh), color por defecto (dc) y zonas pulsables (hs: [acción, [x,y,ancho,alto] en %, título]). */
const MODELS = {
  // DEH-4250BT (original)
  "orig": {
    "bh": 0,
    "dc": 0
  },
  // MVH-S218BT
  "m1": {
    "src": "assets/radios/m1.webp",
    "ar": "1410/443",
    "kb": [18.79, 28.89, 14.18, 45.15],
    "lcd": [39.5, 37.25, 43.12, 26.64],
    "cov": "#1a1c1e",
    "bh": -155,
    "dc": 4,
    "hs": [
      ["pw", [6.03, 34.99, 6.03, 6.09], "SRC/OFF"],
      ["ls", [11.35, 45.15, 4.47, 13.54], "Lista"],
      ["rs", [6.38, 60.95, 4.26, 8.13], "Atrás"],
      ["dm", [12.77, 62.75, 4.47, 7.22], "DISP"],
      ["ph", [13.48, 75.62, 9.72, 8.35], "Teléfono"],
      ["rs", [28.87, 76.3, 4.96, 5.64], "Atrás"],
      ["pv", [34.96, 75.85, 6.67, 6.09], "Anterior"],
      ["nx", [42.2, 75.85, 6.52, 6.09], "Siguiente"],
      ["c0", [49.15, 75.85, 4.75, 6.32], "Carpeta anterior"],
      ["c1", [54.4, 75.85, 5.89, 6.32], "Carpeta siguiente"],
      ["eq", [60.99, 75.85, 4.75, 6.32], "EQ"],
      ["tg", [66.31, 75.85, 5.11, 6.32], "Play / Pausa"],
      ["sh", [72.7, 75.85, 4.68, 6.32], "Mix"],
      ["mu", [78.01, 75.85, 5.04, 6.32], "Mute"],
      ["ej", [86.88, 36.12, 6.24, 31.6], "Elegir carpeta"]
    ]
  },
  // DEH CD Bluetooth
  "m2": {
    "src": "assets/radios/m2.webp",
    "ar": "872/276",
    "kb": [11.24, 18.12, 16.51, 52.17],
    "lcd": [48.05, 37.68, 35.44, 28.99],
    "cov": "#161819",
    "bh": 0,
    "dc": 0,
    "hs": [
      ["pv", [6.31, 35.51, 5.16, 19.57], "Anterior"],
      ["nx", [27.98, 35.51, 4.82, 19.57], "Siguiente"],
      ["pw", [6.54, 19.93, 4.93, 11.59], "Power"],
      ["rs", [26.83, 19.93, 4.36, 11.59], "Atrás"],
      ["ls", [35.55, 20.29, 3.9, 11.23], "Lista"],
      ["eq", [33.72, 42.39, 6.88, 9.78], "EQ"],
      ["bd", [26.95, 60.14, 5.39, 10.87], "SRC"],
      ["dm", [33.72, 60.14, 5.96, 10.87], "DISP"],
      ["c0", [41.28, 19.57, 3.44, 11.96], "Carpeta anterior"],
      ["c1", [41.28, 59.42, 3.44, 10.14], "Carpeta siguiente"],
      ["ej", [87.84, 36.96, 4.82, 15.22], "Elegir carpeta"],
      ["mu", [87.84, 53.62, 4.82, 14.49], "Mute"]
    ]
  },
  // Alpine iDA-X305
  "m3": {
    "src": "assets/radios/m3.webp",
    "ar": "1060/326",
    "kb": [35.0, 16.26, 20.75, 67.48],
    "lcd": [67.92, 17.79, 25.19, 65.03],
    "cov": "#0e1a30",
    "bh": 0,
    "dc": 0,
    "hs": [
      ["pw", [10.38, 39.26, 6.23, 23.31], "SOUND/Power"],
      ["rs", [19.43, 42.94, 9.06, 14.72], "Atrás"],
      ["pv", [7.55, 15.34, 5.66, 7.98], "Anterior"],
      ["nx", [17.36, 15.34, 4.15, 7.98], "Siguiente"],
      ["tg", [16.6, 78.53, 5.28, 7.36], "Play / Pausa"],
      ["ph", [29.43, 21.47, 3.77, 12.27], "Teléfono"],
      ["eq", [52.83, 22.09, 3.77, 12.27], "EQ"],
      ["dm", [55.09, 44.79, 7.36, 10.43], "VIEW"],
      ["ls", [52.83, 68.1, 4.15, 11.04], "Lista"],
      ["mu", [29.43, 68.1, 3.77, 11.04], "Mute"],
      ["ej", [3.96, 36.81, 3.96, 25.77], "Elegir carpeta"]
    ]
  },
  // MVH-S215BT
  "m4": {
    "src": "assets/radios/m4.webp",
    "ar": "940/290",
    "kb": [14.04, 23.79, 12.34, 40.0],
    "lcd": [42.98, 33.1, 40.85, 31.03],
    "cov": "#232425",
    "bh": -155,
    "dc": 4,
    "hs": [
      ["pw", [5.53, 17.24, 7.02, 15.17], "SRC/OFF"],
      ["ph", [5.53, 42.76, 7.02, 13.1], "Teléfono"],
      ["rs", [5.96, 64.83, 6.6, 17.24], "Atrás"],
      ["dm", [35.11, 20.69, 3.62, 11.72], "DISP"],
      ["eq", [30.43, 37.24, 8.09, 17.93], "BASS / EQ"],
      ["pv", [27.02, 75.86, 5.53, 9.66], "Anterior"],
      ["nx", [32.77, 75.86, 5.53, 9.66], "Siguiente"],
      ["ej", [86.81, 31.03, 7.45, 34.48], "Elegir carpeta"],
      ["c0", [41.17, 75.17, 6.6, 11.03], "Carpeta anterior"],
      ["c1", [48.3, 75.17, 6.6, 11.03], "Carpeta siguiente"],
      ["tg", [56.06, 75.17, 6.6, 11.03], "Play / Pausa"],
      ["tg", [63.19, 75.17, 6.6, 11.03], "Play / Pausa"],
      ["sh", [71.06, 75.17, 6.6, 11.03], "Mix"],
      ["ls", [78.09, 75.17, 6.6, 11.03], "Lista"]
    ]
  },
  // JVC XD-X280BT
  "m5": {
    "src": "assets/radios/m5.webp",
    "ar": "1313/410",
    "kb": [10.81, 26.34, 14.47, 46.34],
    "lcd": [31.84, 38.54, 41.13, 25.85],
    "cov": "#050505",
    "bh": -155,
    "dc": 4,
    "hs": [
      ["pw", [6.4, 19.02, 5.33, 7.32], "SRC/OFF"],
      ["nx", [6.4, 34.63, 4.57, 6.83], "Siguiente"],
      ["pv", [6.4, 60.98, 4.57, 6.83], "Anterior"],
      ["ph", [6.55, 71.22, 16.91, 12.2], "Teléfono"],
      ["tg", [76.47, 71.22, 17.21, 12.2], "Play / Pausa"],
      ["ls", [24.07, 71.71, 3.96, 7.8], "Lista"],
      ["c1", [29.55, 71.71, 5.48, 7.8], "Carpeta siguiente"],
      ["c0", [36.71, 71.71, 5.64, 7.8], "Carpeta anterior"],
      ["sh", [43.87, 71.71, 5.64, 7.8], "Mix"],
      ["rs", [51.03, 71.71, 5.64, 7.8], "Repetir"],
      ["dm", [58.26, 71.71, 5.64, 7.8], "DISP"],
      ["eq", [65.42, 71.71, 5.64, 7.8], "EQ"],
      ["mu", [72.51, 71.71, 3.96, 7.8], "Mute"],
      ["ej", [84.23, 37.56, 9.6, 24.39], "Elegir carpeta"]
    ]
  },
  // MVH-S215BT Spotify
  "m6": {
    "src": "assets/radios/m6.webp",
    "ar": "947/293",
    "kb": [17.11, 26.96, 13.52, 43.69],
    "lcd": [45.93, 35.84, 35.48, 26.62],
    "cov": "#0a0a0a",
    "bh": -155,
    "dc": 4,
    "hs": [
      ["pw", [5.81, 13.65, 8.24, 17.06], "SRC/OFF"],
      ["ph", [7.6, 40.27, 7.6, 19.8], "Teléfono"],
      ["rs", [7.39, 77.82, 6.55, 10.24], "Atrás"],
      ["ls", [30.1, 18.77, 6.34, 8.87], "Lista"],
      ["dm", [35.27, 46.42, 2.96, 9.56], "DISP"],
      ["pv", [30.41, 75.77, 6.97, 9.56], "Anterior"],
      ["nx", [37.8, 75.77, 6.97, 9.56], "Siguiente"],
      ["c0", [43.72, 75.77, 5.91, 10.24], "Carpeta anterior"],
      ["c1", [50.05, 75.77, 5.91, 10.24], "Carpeta siguiente"],
      ["tg", [57.87, 75.77, 5.91, 10.24], "Play / Pausa"],
      ["tg", [63.99, 75.77, 5.91, 10.24], "Play / Pausa"],
      ["sh", [72.02, 75.77, 5.7, 10.24], "Mix"],
      ["eq", [78.14, 75.77, 5.7, 10.24], "EQ"],
      ["ej", [87.22, 33.45, 6.97, 33.45], "Elegir carpeta"]
    ]
  },
  // Alpine UTE-200BT
  "m7": {
    "src": "assets/radios/m7.webp",
    "ar": "825/251",
    "kb": [14.06, 31.87, 10.67, 35.06],
    "lcd": [37.94, 40.64, 43.88, 27.09],
    "cov": "#17181a",
    "bh": 0,
    "dc": 0,
    "hs": [
      ["pw", [6.67, 39.84, 7.03, 21.91], "SOURCE/OFF"],
      ["ph", [9.7, 14.34, 4.12, 11.16], "Teléfono"],
      ["nx", [27.64, 34.26, 4.12, 9.56], "Siguiente"],
      ["pv", [27.64, 63.75, 4.12, 9.56], "Anterior"],
      ["eq", [25.94, 43.03, 5.82, 17.53], "EQ"],
      ["ej", [86.3, 34.26, 6.06, 31.87], "Elegir carpeta"],
      ["mu", [8.97, 78.09, 5.33, 10.36], "Mute"],
      ["ls", [33.94, 75.7, 8.73, 10.36], "Lista"],
      ["c0", [43.39, 75.7, 5.7, 10.36], "Carpeta anterior"],
      ["c1", [49.09, 75.7, 5.7, 10.36], "Carpeta siguiente"],
      ["tg", [55.76, 75.7, 5.7, 10.36], "Play / Pausa"],
      ["rs", [61.45, 75.7, 5.82, 10.36], "Repetir"],
      ["sh", [68.12, 75.7, 5.7, 10.36], "Mix"],
      ["mu", [73.82, 75.7, 5.82, 10.36], "Mute"],
      ["dm", [81.45, 76.49, 4.61, 9.56], "DISP"]
    ]
  }
};

;
/**
 * Baterías: valores de la simulación eléctrica (separados de la interfaz).
 * Cambia aquí los números y no hace falta tocar ningún componente.
 *
 * PRECIOS, TIEMPOS DE RECARGA y monedas: los manda el SERVIDOR (SQL-BATERIAS.sql: tablas bat_catalogo y bat_config) y se pueden cambiar
 * desde el panel de administrador > Monedas. Los valores "precio" y "recargaS" de abajo solo se usan si el servidor aún no respondió.
 *
 * Modelo (resumen):
 *   voltaje en vacío   = vVacio + (vLleno - vVacio) * (1 - (1 - carga) ^ curva)      (curva alta = voltaje muy estable hasta el final)
 *   caída por consumo  = corriente * resistencia interna (varias baterías en PARALELO: la resistencia baja y la capacidad se suma)
 *   voltaje del equipo = voltaje en vacío - caída            (con "Más voltaje" suma vExtraMotor, hasta el máximo de la batería)
 *   carga que se gasta = corriente * tiempo * aceleracion / capacidad útil total
 */
const BAT_CFG = {
    aceleracion: 1.5,          // 1 s real = 1.5 s de consumo (antes 4: se descargaba muy rapido). Pon 1 para tiempo real; sube el numero para que se descargue mas rapido.
    vCritico: 10.8,            // por debajo, se activa la protección del sistema de sonido
    cargaCritica: 0.05,        // o con menos de este nivel de carga (0.05 = 5 %)
    proteccion: 0.55,          // en protección el volumen de salida baja a esta fracción
    vReferencia: 12.6,         // el volumen "normal" del radio corresponde a este voltaje
    vExtraMotor: 1.8,          // lo que suma el interruptor "Más voltaje" (como con el motor encendido)
    consumoMasVoltaje: 1.2,    // "Más voltaje" gasta un 20 % más
    corriente: {               // amperios
        reposo: 1.2,           // equipo encendido sin sonar
        maxReproduccion: 38,   // sonando al volumen máximo
        graves: 0.8,           // cuánto sube el consumo con los graves fuertes
        porEqExtra: 0.12,      // cada EQ encendido de más
        porRefuerzoEq: 0.1     // por cada punto del refuerzo de EQ (EQX)
    },
    referenciaAmp: 12,         // consumo medio que se usa para mostrar la "duración estimada"
    tickMs: 500, guardarCadaMs: 30000, latidoCadaMs: 30000, refrescarCadaMs: 120000,
    tipos: {
        gel100: {
            nombre: "Batería de gelatina 100 Ah", familia: "gel", calidad: "Básica", ah: 100, util: 0.5,
            vLleno: 12.7, vVacio: 11.2, curva: 1.5, rIntMohm: 12, vMax: 14.4, eficienciaRecarga: 0.85,
            precio: 80, recargaS: 300,
            descripcion: "Económica y estable. Ideal para empezar: menos capacidad útil y se descarga antes."
        },
        gel200: {
            nombre: "Batería de gelatina 200 Ah", familia: "gel", calidad: "Intermedia", ah: 200, util: 0.55,
            vLleno: 12.8, vVacio: 11.4, curva: 1.7, rIntMohm: 6, vMax: 14.4, eficienciaRecarga: 0.88,
            precio: 200, recargaS: 300,
            descripcion: "Más del doble de energía que la de 100 Ah. Buena estabilidad, pero cae más de voltaje bajo cargas fuertes que el litio."
        },
        litio: {
            nombre: "Batería de litio (Lithium)", familia: "litio", calidad: "Premium", ah: 200, util: 0.95,
            vLleno: 13.4, vVacio: 12.0, curva: 4, rIntMohm: 3, vMax: 14.6, eficienciaRecarga: 0.98,
            precio: 800, recargaS: 240,
            descripcion: "Voltaje casi plano hasta el final, la mayor energía útil y la recarga más rápida. Solo se combina con otras de litio."
        }
    }
};

;
/**
 * Personalización: modelos y ajustes
 * Cambio de modelo de radio, forma, brillo, orden de EQs, aplicar/guardar configuración y helpers de UI.
 */

const ACT = { pw: () => power(), ls: () => listN(), rs: () => restart(), dm: () => dmode(), ph: () => phone(), pv: () => prev(), nx: () => next(), c0: () => chPl(-1), c1: () => chPl(1), eq: () => eq(), tg: () => toggle(), sh: () => shuf(), mu: () => mute(), ej: () => eject(), bd: () => band() };

function setModel(id) {
    if (curModel === id)
        return;
    const m = MODELS[id] || MODELS.orig, f = $("face");
    curModel = id;
    f.querySelectorAll(".gen").forEach(e => e.remove());
    document.body.dataset.m = id;
    document.body.classList.toggle("nm", id !== "orig");
    const L = (e, r) => {
        e.style.left = r[0] + "%";
        e.style.top = r[1] + "%";
        e.style.width = r[2] + "%";
        e.style.height = r[3] + "%";
    };
    f.style.setProperty("--ar", m.ar || "1376/768");
    const kb = $("kb");
    if (id === "orig") {
        kb.removeAttribute("style");
        L($("dsp"), [49.2, 44.3, 32, 14.6]);
        L($("offl"), [49.2, 44.3, 32, 14.6]);
    }
    else {
        L(kb, m.kb);
        kb.style.borderRadius = "50%";
        L($("dsp"), m.lcd);
        L($("offl"), m.lcd);
        const cv = mkEl("div", "a cov gen");
        L(cv, m.lcd);
        cv.style.background = m.cov;
        f.insertBefore(cv, $("dsp"));
        m.hs.forEach(h => {
            const b = mkEl("button", "h gen");
            L(b, h[1]);
            b.title = h[2];
            b.onclick = ACT[h[0]];
            f.appendChild(b);
        });
    }
    try {
        setColor(ci, false);
    }
    catch (e) { }
}

const RADIOS = { orig: "brightness(1)", m1: "brightness(1)", m2: "brightness(1)", m3: "brightness(1)", m4: "brightness(1)", m5: "brightness(1)", m6: "brightness(1)", m7: "brightness(1)" };
const SHAPES = { cl: "", sq: "sh-sq", round: "sh-round", bevel: "sh-bevel", noears: "sh-noears", carbon: "sh-carbon", neon: "sh-neon", metal: "sh-metal", double: "sh-double", wood: "sh-wood", perf: "sh-perf", chamfer: "sh-chamfer", glass: "sh-glass" };
const cfgD = { radio: "orig", bri: 1.1, shape: "cl", pad: 2.4, q: 1.2, glow: 1, vals: false, img: "", vmax: 62, eqx: 1, volt: false, order: null, bg: "", fondo: "", fondoOsc: .35, edge: "", edgeI: .8, rgbV: 1, pulse: false, vig: 0, grain: false, scan: false };
let curModel = "orig", vip = false, cfg = Object.assign({}, cfgD);
bgImg = document.querySelector("#face img.bg"); var bgOrig = bgImg ? bgImg.getAttribute("src") : "";

try {
    vip = true;
    const s = JSON.parse(localStorage.getItem("pioneerVIPcfg"));
    if (s)
        Object.assign(cfg, s);
}
catch (e) { }

if (cfg.radio === "mine" || !(cfg.radio in RADIOS)) {
    cfg.radio = "orig";
    cfg.img = "";
}

function cfgSave() {
    try {
        localStorage.setItem("pioneerVIPcfg", JSON.stringify(cfg));
    }
    catch (e) {
        try {
            const c = Object.assign({}, cfg, { img: "" });
            localStorage.setItem("pioneerVIPcfg", JSON.stringify(c));
        }
        catch (e2) { }
    }
}

let wrapEl = null;

function ordOf(c) {
    const n = units.length, base = [];
    for (let i = 0; i < n; i++)
        base.push("e" + i);
    base.push("r");
    for (let i = 0; i < (typeof atq !== "undefined" ? atq.length : 0); i++)
        base.push("a" + i);
    let o = Array.isArray(c && c.order) ? c.order.filter((t, i, a) => base.indexOf(t) >= 0 && a.indexOf(t) === i) : [];
    base.forEach(t => {
        if (o.indexOf(t) < 0)
            o.push(t);
    });
    return o;
}

function applyOrder(c) {
    c = c || (vip ? cfg : cfgD);
    const es = $("eqs");
    wrapEl = wrapEl || document.querySelector(".stack .wrap");
    const w = wrapEl;
    if (!es || !w)
        return;
    ordOf(c).forEach(t => es.appendChild(t === "r" ? w : (t[0] === "a" ? atq[+t.slice(1)] : units[+t.slice(1)]).el));
    units.forEach(u => u.el.classList.toggle("abv", u.el.nextElementSibling === w));
    atq.forEach(a => a.el.classList.toggle("abv", a.el.nextElementSibling === w));
    if (typeof atFitSoon === "function")
        atFitSoon();
    w.classList.toggle("top", es.firstElementChild === w);
}

function applyCfg() {
    if (typeof DBM !== "undefined") DBM.sync();
    const c = vip ? cfg : cfgD, f = $("face"), cs = $("case"), es = $("eqs");
    f.style.setProperty("--rs", RADIOS[c.radio] || RADIOS.orig);
    f.style.setProperty("--rbr", c.bri);
    const mid = MODELS[c.radio] ? c.radio : "orig";
    const want = MODELS[mid].src || bgOrig;
    setModel(mid);
    if (bgImg && bgImg.getAttribute("src") !== want)
        bgImg.setAttribute("src", want);
    cs.className = "case " + (SHAPES[c.shape] || "");
    cs.style.setProperty("--pad", c.pad + "%");
    es.style.setProperty("--glow", c.glow);
    es.classList.toggle("nov", !c.vals);
    eqQ = c.q;
    units.forEach(u => {
        if (u.nodes)
            u.nodes.bands.forEach(b => b.Q.value = eqQ);
    });
    {
        const nv = Math.max(10, Math.min(200, Math.round(+c.vmax || 62)));
        if (nv !== VMAX) {
            v = Math.min(nv, Math.round(v / VMAX * nv));
            VMAX = nv;
            setVol();
        }
        EQX = Math.max(1, Math.min(5, +c.eqx || 1));
        vmBase = c.volt ? 14.4 : 12.6;
        VG = Math.pow(vmBase / 12.6, 2);
        applyAudio();
    }
    applyOrder(c);
    if (typeof applyEstilo === "function")
        applyEstilo(c);
    try { if (typeof applyPintura === "function") applyPintura(c); } catch (e) { }   /* al arrancar, pinturas.js aun no termino de cargar: se repite al final de ese archivo */
    $("vipb").textContent = "\u2B50 Personalizaci\u00f3n";
}

const mkEl = (t, c, x) => {
    const e = document.createElement(t);
    if (c)
        e.className = c;
    if (x != null)
        e.textContent = x;
    return e;
};

function chips(list, cur, fn) {
    const w = mkEl("div", "vch");
    list.forEach(p => {
        const b = mkEl("button", "vchip" + (p[0] === cur ? " on" : ""), p[1]);
        b.onclick = () => {
            fn(p[0]);
            [...w.children].forEach(c => c.classList.toggle("on", c === b));
        };
        w.appendChild(b);
    });
    return w;
}

function slider(lab, min, max, step, val, fn, fmt) {
    const r = mkEl("label", "vsl"), s = mkEl("span", "", lab + ": " + fmt(val)), i = mkEl("input");
    i.type = "range";
    i.min = min;
    i.max = max;
    i.step = step;
    i.value = val;
    i.oninput = () => {
        const x = parseFloat(i.value);
        s.textContent = lab + ": " + fmt(x);
        fn(x);
    };
    r.append(s, i);
    return r;
}

;
/**
 * Estilo (pestaña del pase de Personalización)
 * Solo decoración: fondo de la página, luz de neón alrededor de la caja (puede latir con la música),
 * viñeta, grano de película y líneas de pantalla. No toca el audio ni los chucheros.
 */

const ESTBG = {
    noche: "radial-gradient(ellipse at 50% 0%,#12285a,#050b1c 70%)",
    vino: "radial-gradient(ellipse at 50% 0%,#4a1024,#14040a 70%)",
    bosque: "radial-gradient(ellipse at 50% 0%,#12402a,#04120a 70%)",
    violeta: "radial-gradient(ellipse at 50% 0%,#3a1a6a,#0c0618 70%)",
    atardecer: "linear-gradient(180deg,#2a1450,#8a2f5c 55%,#e8793a)",
    humo: "radial-gradient(ellipse at 50% 0%,#34363b,#0b0b0d 75%)"
};
const ESTBGL = [["", "Negro"], ["noche", "Azul noche"], ["vino", "Vino"], ["bosque", "Bosque"], ["violeta", "Violeta"], ["atardecer", "Atardecer"], ["humo", "Gris humo"]];
const ESTEDGE = [["", "Apagada"], ["#2f8cff", "Azul"], ["#ff3b3b", "Rojo"], ["#35e07a", "Verde"], ["#ff9f1c", "Naranja"], ["#b46bff", "Violeta"], ["#ff4fd8", "Rosa"], ["#ffffff", "Blanca"], ["rgb", "\uD83C\uDF08 RGB"]];
const ESTD = { bg: "", fondo: "", fondoOsc: .35, edge: "", edgeI: .8, rgbV: 1, pulse: false, vig: 0, grain: false, scan: false };
let estPulse = false, estI = .8, estRun = false, estRgb = false, estV = 1;

function estFx() {
    let f = document.getElementById("fx");
    if (!f) {
        f = document.createElement("div");
        f.id = "fx";
        document.body.appendChild(f);
    }
    return f;
}

/* La luz de ne\u00f3n mide la cajita (no el contenedor) y se adapta a su tama\u00f1o y a sus esquinas. */
function estNeon() {
    const w = document.querySelector(".casew"), k = document.getElementById("case");
    if (!w || !k)
        return;
    let n = document.getElementById("neon");
    if (!n) {
        n = document.createElement("div");
        n.id = "neon";
        w.appendChild(n);
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(estNeon);
            ro.observe(k);
            ro.observe(w);
        }
        window.addEventListener("resize", estNeon);
    }
    n.style.left = k.offsetLeft + "px";
    n.style.top = k.offsetTop + "px";
    n.style.width = k.offsetWidth + "px";
    n.style.height = k.offsetHeight + "px";
    n.style.borderRadius = getComputedStyle(k).borderRadius || "14px";
    w.style.setProperty("--ns", Math.max(3, k.offsetWidth * .012).toFixed(1) + "px");
}

function estLoop() {
    requestAnimationFrame(estLoop);
    if (!estPulse && !estRgb)
        return;
    const w = document.querySelector(".casew");
    if (!w)
        return;
    if (estRgb)
        w.style.setProperty("--ec", "hsl(" + Math.round(performance.now() / 1000 * 60 * estV % 360) + ",100%,55%)");
    if (estPulse) {
        const b = typeof spkL !== "undefined" ? spkL.b : 0;
        w.style.setProperty("--eo", Math.min(1, estI * (.5 + .9 * b)).toFixed(3));
    }
}

function applyEstilo(c) {
    c = c || {};
    const d = Object.assign({}, ESTD, c), w = document.querySelector(".casew"), f = estFx();
    const fo = /^data:image\//.test(d.fondo || "") ? d.fondo : "";
    document.body.style.setProperty("--pgbg", fo ? "linear-gradient(rgba(0,0,0," + Math.max(0, Math.min(.85, +d.fondoOsc)) + "),rgba(0,0,0," + Math.max(0, Math.min(.85, +d.fondoOsc)) + ")),url(\"" + fo + "\") center/cover no-repeat" : ESTBG[d.bg] || "#000");
    if (w) {
        estRgb = d.edge === "rgb";
        estV = Math.max(.2, Math.min(4, +d.rgbV || 1));
        const col = estRgb ? "rgb" : /^#[0-9a-f]{6}$/i.test(d.edge || "") ? d.edge : "";
        w.classList.toggle("edge", !!col);
        if (col && !estRgb)
            w.style.setProperty("--ec", col);
        estI = Math.max(.1, Math.min(1.5, +d.edgeI || .8));
        estPulse = !!col && !!d.pulse;
        w.style.setProperty("--eo", (estI * .8).toFixed(3));
        estNeon();
    }
    f.style.setProperty("--vig", Math.max(0, Math.min(.85, +d.vig || 0)));
    f.classList.toggle("grain", !!d.grain);
    f.classList.toggle("scan", !!d.scan);
    if (!estRun) {
        estRun = true;
        estLoop();
    }
}

/* Reduce la foto elegida para que viaje bien con la cuenta (max. ~380 KB). */
function estShrink(f) {
    return new Promise((res, rej) => {
        const u = URL.createObjectURL(f), im = new Image();
        im.onload = () => {
            const k = Math.min(1, 1280 / Math.max(im.width, im.height)), cv = document.createElement("canvas");
            cv.width = Math.max(1, Math.round(im.width * k));
            cv.height = Math.max(1, Math.round(im.height * k));
            cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
            URL.revokeObjectURL(u);
            let q = .78, d = cv.toDataURL("image/jpeg", q);
            while (d.length > 380000 && q > .3) {
                q -= .08;
                d = cv.toDataURL("image/jpeg", q);
            }
            d.length > 380000 ? rej(new Error("grande")) : res(d);
        };
        im.onerror = () => rej(new Error("imagen"));
        im.src = u;
    });
}

/* Contenido de la pestaña "Estilo": set(k, v) guarda y aplica cada cambio. */
function estiloTab(body, set, cfg, repaint) {
    const pc = mkEl("div", "vch"), cp = mkEl("label", "vchip cpkc", "Otro color"), ci = mkEl("input");
    ci.type = "color";
    ci.value = /^#[0-9a-f]{6}$/i.test(cfg.edge || "") ? cfg.edge : "#2f8cff";
    ci.oninput = () => set("edge", ci.value);
    cp.appendChild(ci);
    const sw = (lab, k) => {
        const t = mkEl("label", "vtg"), cb = mkEl("input");
        cb.type = "checkbox";
        cb.checked = !!cfg[k];
        cb.onchange = () => set(k, cb.checked);
        t.append(cb, mkEl("span", "", lab));
        return t;
    };
    const fi = mkEl("input"), up = mkEl("button", "vchip", "\uD83D\uDCF7 Subir mi propio fondo"), qt = mkEl("button", "vchip", "Quitar mi fondo"), fm = mkEl("div", "vmsg");
    fi.type = "file";
    fi.accept = "image/*";
    fi.style.display = "none";
    up.type = qt.type = "button";
    qt.style.display = cfg.fondo ? "" : "none";
    up.onclick = () => fi.click();
    fi.onchange = () => {
        if (!fi.files[0])
            return;
        fm.textContent = "Cargando...";
        estShrink(fi.files[0]).then(d => { set("fondo", d); repaint(); }, () => { fm.textContent = "No pude usar esa imagen. Prueba con otra foto."; });
    };
    qt.onclick = () => { set("fondo", ""); repaint(); };
    const fr = mkEl("div", "vch");
    fr.append(up, qt);
    body.append(
        mkEl("div", "vh", "FONDO DE LA P\u00c1GINA"),
        chips(ESTBGL, cfg.fondo ? "x" : cfg.bg || "", k => { set("fondo", ""); set("bg", k); repaint(); }),
        fr, fi, fm,
        cfg.fondo ? slider("Oscurecer mi fondo", 0, .85, .05, cfg.fondoOsc == null ? .35 : cfg.fondoOsc, x => set("fondoOsc", x), x => Math.round(x / .85 * 100) + "%") : mkEl("span"),
        mkEl("p", "vs", "Tu foto se guarda con tu cuenta. Se ve cuando no tienes un lugar elegido (\"Cambia tu lugar\")."),
        mkEl("div", "vh", "LUZ ALREDEDOR DE LA CAJA"),
        chips(ESTEDGE, cfg.edge === "rgb" || /^#[0-9a-f]{6}$/i.test(cfg.edge || "") ? cfg.edge : "", k => set("edge", k)),
        pc, cp,
        slider("Intensidad de la luz", .2, 1.5, .05, cfg.edgeI == null ? .8 : cfg.edgeI, x => set("edgeI", x), x => Math.round(x * 100) + "%"),
        sw("🎵 Que lata con la música", "pulse"),
        mkEl("div", "vh", "EFECTOS DE PANTALLA"),
        slider("Viñeta (bordes oscuros)", 0, .8, .05, cfg.vig || 0, x => set("vig", x), x => Math.round(x / .8 * 100) + "%"),
        sw("🎞️ Grano de película", "grain"),
        sw("📺 Líneas de pantalla", "scan")
    );
    const rs = mkEl("button", "vrs", "Restablecer estilo");
    rs.onclick = () => {
        Object.keys(ESTD).forEach(k => set(k, ESTD[k]));
        repaint();
    };
    body.appendChild(rs);
}

;
/**
 * Personalización: códigos y pago
 * Generar/validar códigos y botón de PayPal.
 */

/*
 * GLOSARIO (nombres cortos de este archivo)
 *   vppLoad  dibuja el boton de PayPal de un pase y verifica el pago en /api/pago.
 *   donLoad  igual, para donaciones (monto a elegir).
 *   vpagado  tras pagar: pide al servidor el codigo/pase y lo activa.
 *   vGate    casilla de terminos y condiciones que desbloquea el pago.
 *   Ordenes de PayPal: siempre bien digital (DIGITAL_GOODS) y sin envio (NO_SHIPPING).
 */

let vnew = false;

/* Los c\u00f3digos ya NO se validan con una f\u00f3rmula en la p\u00e1gina (cualquiera la podr\u00eda copiar): solo el servidor dice si un c\u00f3digo vale.
   Aqu\u00ed solo se revisa que tenga forma de c\u00f3digo. */
function vfmt(k) {
    return k.slice(0, 2) + "-" + k.slice(2, 6) + "-" + k.slice(6);
}

function kvalid(k) {
    return /^KB[0-9A-Z]{8}$/.test(k);
}

function cvalid(k) {
    return /^CP[0-9A-Z]{8}$/.test(k);
}

function vvalid(k) {
    return /^[0-9A-Z]{6,16}$/.test(k);
}

function vgrant(code, fresh) {
    vip = true;
    vnew = !!fresh;
    try {
        localStorage.setItem("pioneerVIP", "1");
        localStorage.setItem("pioneerVIPcode", code);
    }
    catch (e) { }
    applyCfg();
    vtab = 0;
    vipOpen();
}

function vcodeBox(c) {
    let k = "";
    try {
        k = localStorage.getItem("pioneerVIPcode") || "";
    }
    catch (e) { }
    if (!k)
        return;
    if (k === "ADMIN") {
        const a = mkEl("div", "vcb new");
        a.appendChild(mkEl("div", "", "\uD83D\uDD11 Acceso admin activo: personalizaci\u00f3n gratis"));
        c.appendChild(a);
        return;
    }
    const b = mkEl("div", "vcb" + (vnew ? " new" : "")), cp = mkEl("button", "", "Copiar");
    cp.onclick = () => {
        try {
            navigator.clipboard.writeText(k);
            cp.textContent = "Copiado";
        }
        catch (e) { }
    };
    b.append(mkEl("div", "", vnew ? "\u2705 \u00a1Pago recibido! Guarda tu c\u00f3digo de personalizaci\u00f3n:" : "Tu c\u00f3digo de personalizaci\u00f3n:"), mkEl("b", "", k), cp);
    c.appendChild(b);
    vnew = false;
}

/* Canjea el código en el servidor: cada código sirve para una sola cuenta. Devuelve "" si todo bien, o el texto del error. */
async function vsrv(code, tipo) {
    const a = window.rdApi;
    if (!a || !a.REM())
        return "El servidor no est\u00e1 disponible: no se puede activar el c\u00f3digo ahora.";   /* sin confirmaci\u00f3n clara del servidor no se desbloquea nada */
    if (!a.tok()) {
        /* el c\u00f3digo se liga a tu cuenta: sin sesi\u00f3n no se puede activar. Se abre el inicio de sesi\u00f3n. */
        try { if (a.login) setTimeout(a.login, 50); } catch (e) { }
        return "Primero inicia sesi\u00f3n (o crea tu cuenta) y luego vuelve a poner tu c\u00f3digo: se liga a tu cuenta.";
    }
    try {
        const r = await a.rpc("canjear", { p_token: a.tok(), p_codigo: code });
        if (r && r.error === "codigo_en_uso")
            return "Ese c\u00f3digo ya fue usado en otra cuenta.";
        if (r && r.error === "bloqueado")
            return "Demasiados intentos fallidos. Espera 15 minutos.";
        if (!r || typeof r !== "object" || r.error || (r.tipo !== "vip" && r.tipo !== "kit" && r.tipo !== "cro"))
            return "C\u00f3digo incorrecto.";
        /* el producto que devuelve el servidor tiene que ser el que se est\u00e1 canjeando en este formulario */
        if (r.tipo !== tipo) {
            try { if (a.refresh) a.refresh(); } catch (e) { }   /* el servidor ya lo acredit\u00f3 a tu cuenta: se actualiza el estado real */
            return r.tipo === "cro" ? "Ese c\u00f3digo es de Crossover y Procesador. Ponlo en la ventana de Crossover y Procesador." : r.tipo === "kit" ? "Ese c\u00f3digo es de Kitipo y Bajos. Ponlo en la ventana de Kitipo y Bajos." : "Ese c\u00f3digo es de la Personalizaci\u00f3n VIP. Ponlo en la ventana de Personalizaci\u00f3n.";
        }
        return "";
    }
    catch (e) {
        if (e.message === "sesion")
            return "Vuelve a iniciar sesi\u00f3n.";
        return "No se pudo verificar el c\u00f3digo. Revisa tu conexi\u00f3n.";
    }
}

/* Despu\u00e9s de pagar con PayPal, el servidor (api/pago) verifica la orden con PayPal y crea un c\u00f3digo que no se puede falsificar. */
async function vpagado(o, tipo, msg, ok) {
    const orden = String(o && o.id || "");
    msg.className = "vmsg";
    msg.textContent = "Verificando tu pago...";
    try {
        const r = await fetch(window.RD_API_PAGO || "/api/pago", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden, tipo, token: window.rdApi && window.rdApi.tok ? window.rdApi.tok() : "" }) });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j || !j.codigo || j.tipo !== tipo)
            throw new Error("pago");
        /* el servidor ya acredit\u00f3 el pase a TU cuenta al verificar el pago */
        ok(j.codigo);
    }
    catch (e) {
        msg.textContent = "Recibimos tu pago (orden " + orden + ") pero no pudimos activarlo solo. Escr\u00edbeme por Discord con ese n\u00famero y te lo activo.";
    }
}


/* ---------- Captcha gratis (Cloudflare Turnstile) ----------
   Se activa poniendo RD_TURNSTILE_KEY en config.js (y TURNSTILE_SECRET en Vercel). Sin clave, no se pide. */
let capTok = "";
const capIds = [];
function vCaptcha(host) {
    const k = window.RD_TURNSTILE_KEY || "";
    if (!k)
        return;
    const w = document.createElement("div");
    w.className = "vcap";
    host.appendChild(w);
    const draw = () => { try { capIds.push(turnstile.render(w, { sitekey: k, theme: "dark", callback: t => { capTok = t; }, "expired-callback": () => { capTok = ""; }, "error-callback": () => { capTok = ""; } })); } catch (e) { } };
    if (window.turnstile) { draw(); return; }
    if (!document.getElementById("rdts")) {
        const sc = document.createElement("script");
        sc.id = "rdts"; sc.async = true;
        sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        sc.onload = () => document.dispatchEvent(new Event("rdts"));
        document.head.appendChild(sc);
    }
    document.addEventListener("rdts", draw, { once: true });
}
/* cada captcha sirve una sola vez: se entrega y se reinicia */
function capUsar() {
    const t = capTok;
    capTok = "";
    try { capIds.forEach(i => turnstile.reset(i)); } catch (e) { }
    return t;
}

/* ---------- Orden de PayPal creada en el SERVIDOR (api/crear-orden.js) ----------
   Exige cuenta con sesion, captcha y limite de intentos: asi nadie prueba tarjetas robadas sin cuenta.
   Devuelve el id de la orden, o null si el servidor aun no tiene esa funcion (se usa el metodo anterior). */
async function ordenServidor(tipo, msg, monto) {
    const ap = window.rdApi, tok = ap && ap.tok ? ap.tok() : "";
    const falla = t => { msg.textContent = t; msg.dataset.keep = "1"; throw new Error("orden"); };
    if (!tok)
        falla("Inicia sesi\u00f3n antes de pagar: hace falta una cuenta (el pase se liga a ella).");
    if (window.RD_TURNSTILE_KEY && !capTok)
        falla("Completa la verificaci\u00f3n (captcha) y vuelve a pulsar pagar.");
    const url = (window.RD_API_PAGO || "/api/pago").replace(/pago$/, "crear-orden");
    let r, j;
    try {
        r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo, token: tok, captcha: capUsar(), monto }) });
        j = await r.json().catch(() => null);
    }
    catch (e) { falla("Sin conexi\u00f3n con el servidor. Int\u00e9ntalo de nuevo."); }
    if (r.status === 404 || r.status === 501)
        return null;
    if (!r.ok || !j || !j.id)
        falla({ sesion: "Inicia sesi\u00f3n antes de pagar.", captcha: "No pasaste la verificaci\u00f3n. Int\u00e9ntalo otra vez.", demasiados_intentos: "Demasiados intentos. Espera unos minutos.", monto: "Elige un monto entre $5 y $500." }[j && j.error] || "No se pudo iniciar el pago. Int\u00e9ntalo de nuevo.");
    return j.id;
}

/* T\u00e9rminos y condiciones: hay que aceptarlos antes de poder pagar (PayPal o bot\u00f3n de pago). */
function vGate(use) {
    const E = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
    const w = E("div", "vgate lock"), box = E("div", "vtyc"), lab = E("label", "vtyck"), ck = document.createElement("input"), pay = E("div", "vgpay");
    box.appendChild(E("b", "", "T\u00e9rminos y condiciones"));
    const ul = E("ul");
    ["Pago \u00fanico y digital: el pase se activa en tu cuenta al confirmar el pago.",
        "No hay devoluciones ni reembolsos una vez realizado el pago.",
        "Si tienes un problema con tu compra, abre un ticket en nuestro Discord y lo resolvemos.",
        "Si pierdes el pase (por ejemplo, por perder tu cuenta o tu c\u00f3digo), no se devuelve el dinero: se repone y se te vuelve a poner en tu cuenta.",
        "El pase est\u00e1 ligado a tu cuenta y no se puede transferir ni compartir."].forEach(t => ul.appendChild(E("li", "", t)));
    box.appendChild(ul);
    const a = E("a", "vtyd", "\ud83d\udcac Abrir ticket en Discord");
    a.href = "https://discord.gg/smCVyUgSZW"; a.target = "_blank"; a.rel = "noopener noreferrer";
    box.appendChild(a);
    ck.type = "checkbox";
    lab.append(ck, E("span", "", "He le\u00eddo y acepto los t\u00e9rminos y condiciones"));
    const hint = E("p", "vs vgh", "Acepta los t\u00e9rminos para poder pagar.");
    pay.appendChild(use);
    ck.onchange = () => { w.classList.toggle("lock", !ck.checked); hint.style.display = ck.checked ? "none" : ""; };
    /* mientras no se acepta, los clics en los botones de pago no hacen nada */
    pay.addEventListener("click", e => { if (!ck.checked) { e.stopPropagation(); e.preventDefault(); lab.classList.remove("shake"); void lab.offsetWidth; lab.classList.add("shake"); } }, true);
    const capBox = E("div", "vcapw");
    vCaptcha(capBox);
    w.append(box, lab, hint, capBox, pay);
    return w;
}

/* ---------- App Android (Capacitor) ----------
   Dentro de la APK, las ventanas de PayPal/tarjeta no funcionan bien en la vista web.
   Por eso all\u00ed el pago se hace en la p\u00e1gina web (mismo usuario y misma cuenta) y al volver a la app el pase aparece solo. */
const WEB_URL = "https://radio-musicologos.vercel.app";
function appNativa() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
function appPagoWeb(box, msg, texto) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "vgo"; b.textContent = "\ud83c\udf10 " + texto;
    b.onclick = () => {
        const B = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
        if (B && B.open) B.open({ url: WEB_URL }); else window.open(WEB_URL, "_system");
        msg.textContent = "Paga en la web con tu mismo usuario. Al volver aqu\u00ed, tu pase se activa solo.";
    };
    box.appendChild(b);
    if (!window.__rdVuelta) {
        window.__rdVuelta = 1;
        document.addEventListener("visibilitychange", () => { if (!document.hidden && window.rdApi && window.rdApi.refresh) { try { window.rdApi.refresh(); } catch (e) { } } });
    }
    return true;
}

function vppLoad(box, msg, desc, onPaid, tipo) {
    const id = window.RD_PAYPAL_CLIENT || "";
    if (!id || id.indexOf("TU_CLIENT") >= 0)
        return false;
    if (appNativa())
        return appPagoWeb(box, msg, "Pagar en la web");
    tipo = tipo || "vip";
    const draw = () => setTimeout(() => paypal.Buttons({ style: { layout: "vertical", color: "gold", shape: "pill", label: "pay", height: 44 },
        createOrder: async (d, a) => {
            const ap = window.rdApi;
            if (ap && ap.REM()) {
                const oid = await ordenServidor(tipo, msg);
                if (oid)
                    return oid;
            }
            const nm = desc || "Pioneer Radio Personalizaci\u00f3n";
            /* Respaldo (sin servidor de pagos): la pagina crea la orden. Bien DIGITAL, sin env\u00edo. */
            return a.order.create({
                intent: "CAPTURE",
                purchase_units: [{
                    custom_id: tipo,
                    description: nm.slice(0, 127),
                    soft_descriptor: "PIONEERRADIO",
                    items: [{ name: nm.slice(0, 127), description: "Pase digital de acceso (entrega inmediata por c\u00f3digo)", sku: ("PASE-" + tipo).toUpperCase(), quantity: "1", category: "DIGITAL_GOODS", unit_amount: { currency_code: "USD", value: "5.00" } }],
                    amount: { currency_code: "USD", value: "5.00", breakdown: { item_total: { currency_code: "USD", value: "5.00" } } }
                }],
                application_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", brand_name: "Pioneer Radio" }
            });
        },
        onApprove: (d, a) => a.order.capture().then(o => vpagado(o, tipo, msg, c => onPaid ? onPaid(c) : vgrant(vfmt(c), true))),
        onError: () => {
            if (msg.dataset.keep) { delete msg.dataset.keep; return; }   /* ya mostramos el motivo exacto */
            msg.textContent = "No se pudo completar el pago. Int\u00e9ntalo de nuevo.";
        } }).render(box), 0);
    if (window.paypal) {
        draw();
        return true;
    }
    const sc = document.createElement("script");
    sc.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(id) + "&currency=USD&intent=capture&enable-funding=card&locale=es_US";
    sc.onload = draw;
    sc.onerror = () => {
        msg.textContent = "No se pudo cargar PayPal.";
    };
    document.head.appendChild(sc);
    return true;
}

/* Donaci\u00f3n con monto a elegir: PayPal -> api/pago verifica -> aviso en Discord. No hace falta cuenta. */
function donLoad(box, msg, getAmt) {
    const id = window.RD_PAYPAL_CLIENT || "";
    if (!id || id.indexOf("TU_CLIENT") >= 0)
        return false;
    if (appNativa())
        return appPagoWeb(box, msg, "Donar en la web");
    const draw = () => setTimeout(() => paypal.Buttons({ style: { layout: "vertical", color: "gold", shape: "pill", label: "donate", height: 44 },
        createOrder: async (d, a) => {
            const v = getAmt();
            if (!(v >= 5 && v <= 500)) {
                msg.textContent = "Elige un monto entre $5 y $500.";
                msg.dataset.keep = "1";
                throw new Error("monto");
            }
            const ap = window.rdApi;
            if (ap && ap.REM()) {
                const oid = await ordenServidor("don", msg, v.toFixed(2));
                if (oid)
                    return oid;
            }
            const m2 = v.toFixed(2);
            return a.order.create({
                intent: "CAPTURE",
                purchase_units: [{
                    custom_id: "don",
                    description: "Donaci\u00f3n Pioneer Radio",
                    soft_descriptor: "PIONEERRADIO",
                    items: [{ name: "Donaci\u00f3n Pioneer Radio", quantity: "1", category: "DONATION", unit_amount: { currency_code: "USD", value: m2 } }],
                    amount: { currency_code: "USD", value: m2, breakdown: { item_total: { currency_code: "USD", value: m2 } } }
                }],
                application_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", brand_name: "Pioneer Radio" }
            });
        },
        onApprove: (d, a) => a.order.capture().then(async o => {
            msg.textContent = "Procesando...";
            try {
                const r = await fetch(window.RD_API_PAGO || "/api/pago", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden: String(o && o.id || ""), tipo: "don", token: window.rdApi && window.rdApi.tok ? window.rdApi.tok() : "" }) });
                await r.json().catch(() => null);
            }
            catch (e) { }
            msg.textContent = "\uD83D\uDC9A \u00a1Muchas gracias por tu donaci\u00f3n!";   /* el dinero ya lleg\u00f3 aunque el aviso falle */
        }),
        onError: () => {
            if (msg.dataset.keep) { delete msg.dataset.keep; return; }
            msg.textContent = "No se pudo completar la donaci\u00f3n. Int\u00e9ntalo de nuevo.";
        } }).render(box), 0);
    if (window.paypal) { draw(); return true; }
    const sc = document.createElement("script");
    sc.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(id) + "&currency=USD&intent=capture&enable-funding=card&locale=es_US";
    sc.onload = draw;
    sc.onerror = () => { msg.textContent = "No se pudo cargar PayPal."; };
    document.head.appendChild(sc);
    return true;
}

;
/**
 * Medidor de decibeles (VIP)
 * Aparato flotante que estima que tan fuerte suena la musica. Se puede mostrar/ocultar desde Personalizacion > Medidor.
 * Los numeros son ESTIMADOS: no sustituyen a un sonometro real.
 */
const DBM = (() => {
    const KEY = "pioneerDB";
    const def = { on: false, x: null, y: null, mode: "app", cal: 0, fast: false, wc: "A", hold: false };
    let st = Object.assign({}, def);
    try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
    let el = null, raf = 0, val = 0, max = 0, shown = 0, tdBuf = null, fqBuf = null, wA = null, wC = null, lastN = 0;
    const OFF = { app: 110 };

    const weights = (n, sr) => {
        wA = new Float32Array(n); wC = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const f = Math.max(i * sr / (2 * n), 1), f2 = f * f;
            const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
            const rc = (12194 ** 2 * f2) / ((f2 + 20.6 ** 2) * (f2 + 12194 ** 2));
            wA[i] = (ra * 1.2589) ** 2; wC[i] = (rc * 1.0072) ** 2;
        }
    };
    const getAn = () => (typeof eqNodes !== "undefined" && eqNodes && eqNodes.an);
    const sampleRate = () => (AC && AC.sampleRate) || 44100;

    const read = () => {
        const an = getAn();
        if (!an) return null;
        const n = an.fftSize, m = an.frequencyBinCount;
        if (!tdBuf || tdBuf.length !== n) tdBuf = new Float32Array(n);
        if (!fqBuf || fqBuf.length !== m) fqBuf = new Float32Array(m);
        if (!wA || wA.length !== m || lastN !== sampleRate()) { weights(m, sampleRate()); lastN = sampleRate(); }
        an.getFloatTimeDomainData(tdBuf);
        let s = 0;
        for (let i = 0; i < n; i++) s += tdBuf[i] * tdBuf[i];
        const rms = Math.sqrt(s / n);
        if (rms < 1e-6) return 0;
        let dbfs = 20 * Math.log10(rms);
        /* Solo medios y agudos: se ignoran los graves (menos de 250 Hz) */
        an.getFloatFrequencyData(fqBuf);
        const w = st.wc === "C" ? wC : wA, hz = sampleRate() / an.fftSize, from = Math.ceil(250 / hz);
        let tot = 0, wt = 0;
        for (let i = 1; i < m; i++) {
            const p = Math.pow(10, fqBuf[i] / 10);
            if (!isFinite(p)) continue;
            tot += p;
            if (i >= from) wt += p * w[i];
        }
        if (tot <= 0 || wt <= 0) return 0;
        dbfs += 10 * Math.log10(wt / tot);
        return Math.max(0, Math.min(130, dbfs + OFF.app + st.cal));
    };

    const build = () => {
        el = mkEl("div", "dbm");
        el.id = "dbm";
        el.innerHTML = '<button class="dbm-x" aria-label="Ocultar">\u2715</button><div class="dbm-foam"></div><div class="dbm-neck"></div>' +
            '<div class="dbm-top"></div>' +
            '<div class="dbm-lcd"><div class="dbm-tags"><span id="dbmh" class="dbm-hold">HOLD</span><span id="dbmw">dBA</span></div>' +
            '<div class="dbm-num"><b id="dbmv">--.-</b></div>' +
            '<div class="dbm-bar"><i id="dbmb"></i></div>' +
            '<div class="dbm-tags"><span>MAX <span id="dbmm">--.-</span></span><span id="dbmsp">SLOW</span></div></div>' +
            '<div class="dbm-lbl">Sound Level</div>' +
            '<div class="dbm-btns"><button data-a="wc" title="Ponderaci\u00f3n A/C">A/C</button><button data-a="hold" title="Congelar">HOLD</button><button data-a="spd" title="R\u00e1pido / lento">FAST<br>SLOW</button><button data-a="max" title="Reiniciar m\u00e1ximo">MAX</button></div>' +
            '<div class="dbm-note" id="dbmn"></div>';
        document.body.appendChild(el);
        el.querySelector(".dbm-x").onclick = () => setOn(false);
        el.querySelector(".dbm-btns").onclick = e => {
            const a = e.target.dataset && e.target.dataset.a;
            if (!a) return;
            if (a === "hold") st.hold = !st.hold;
            else if (a === "max") max = 0;
            else if (a === "spd") st.fast = !st.fast;
            else if (a === "wc") st.wc = st.wc === "A" ? "C" : "A";
            save(); paint();
        };
        const top = el; el.style.cursor = "grab";
        let dx = 0, dy = 0, drag = false;
        top.addEventListener("pointerdown", e => {
            if (e.target.closest("button")) return;
            drag = true; const r = el.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top;
            top.setPointerCapture(e.pointerId);
        });
        top.addEventListener("pointermove", e => {
            if (!drag) return;
            place(e.clientX - dx, e.clientY - dy);
        });
        const end = () => { if (drag) { drag = false; save(); } };
        top.addEventListener("pointerup", end);
        top.addEventListener("pointercancel", end);
        place(st.x, st.y);
    };
    const place = (x, y) => {
        const w = el.offsetWidth || 190, h = el.offsetHeight || 230;
        if (x == null || y == null) { x = innerWidth - w - 14; y = innerHeight - h - 70; }
        x = Math.max(4, Math.min(innerWidth - w - 4, x));
        y = Math.max(40, Math.min(innerHeight - h - 4, y));
        el.style.left = x + "px"; el.style.top = y + "px";
        st.x = Math.round(x); st.y = Math.round(y);
    };
    const paint = () => {
        if (!el) return;
        el.querySelector("#dbmw").textContent = st.wc === "A" ? "dBA" : "dBC";
        el.querySelector("#dbmsp").textContent = st.fast ? "FAST" : "SLOW";
        el.querySelector("#dbmh").style.opacity = st.hold ? 1 : .15;
        const n = el.querySelector("#dbmn");
        n.textContent = "Sonido de la app \u00b7 estimado";
    };
    const loop = t => {
        raf = requestAnimationFrame(loop);
        if (!el || st.hold) return;
        const v = read();
        if (v === null) { el.querySelector("#dbmv").textContent = "--.-"; return; }
        const k = st.fast ? .35 : .06;
        val += (v - val) * k;
        if (val > max) max = val;
        el.querySelector("#dbmv").textContent = val < 1 ? "--.-" : val.toFixed(1);
        el.querySelector("#dbmm").textContent = max < 1 ? "--.-" : max.toFixed(1);
        const pct = Math.max(0, Math.min(100, (val - 30) / 100 * 100));
        const b = el.querySelector("#dbmb");
        b.style.width = pct + "%";
        b.className = val > 100 ? "hi" : val > 85 ? "mid" : "";
    };
    const run = async () => {
        if (!vip) { hide(); return; }
        if (!el) build();
        el.style.display = "block";
        paint(); place(st.x, st.y);
        if (!raf) raf = requestAnimationFrame(loop);
    };
    const hide = () => {
        if (el) el.style.display = "none";
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    const setOn = v => { st.on = !!v; save(); st.on ? run() : hide(); };
    const sync = () => { (st.on && vip) ? run() : hide(); };
    window.addEventListener("resize", () => { if (el && el.style.display !== "none") place(st.x, st.y); });
    return {
        st, save, sync, setOn,
        setCal: c => { st.cal = c; save(); },
        reset: () => { max = 0; }
    };
})();

;
/**
 * Personalización: panel
 * Ventana de Personalización (pestañas, radio, caja, ajustes, orden) y botones Personalización / Donación.
 */

let vtab = 0;

function vipClose() {
    $("vipm").classList.remove("show");
}

function vipOpen() {
    let m = $("vipm");
    if (!m) {
        m = mkEl("div", "vm");
        m.id = "vipm";
        m.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "Escape")
                vipClose();
        });
        m.addEventListener("pointerdown", e => {
            if (e.target === m)
                vipClose();
        });
        document.body.appendChild(m);
    }
    m.textContent = "";
    const c = mkEl("div", "vc");
    m.appendChild(c);
    const x = mkEl("button", "vx", "\u2715");
    x.onclick = vipClose;
    if (!vip) {
        c.append(x, mkEl("h2", "", "\u2B50 Personalizaci\u00f3n"), mkEl("p", "vs", "Personaliza m\u00e1s tu radio con un pago \u00fanico"));
        const ul = mkEl("ul");
        ["\uD83D\uDCFB Cambiar de radio", "\uD83D\uDCE6 Cambiar la forma de la cajita", "\uD83C\uDF9A\uFE0F Ajustar a tu gusto los EQs y el radio", "\u26A1 M\u00e1s voltaje (14.4V)", "\uD83C\uDFA8 Estilo: fondo, luz de neón que late con la m\u00fasica y efectos"].forEach(t => ul.appendChild(mkEl("li", "", t)));
        const pr = mkEl("div", "vprice", "$5 ");
        pr.appendChild(mkEl("small", "", "USD \u00b7 pago \u00fanico"));
        const pay = mkEl("button", "vpay", "Pagar con PayPal"), or = mkEl("div", "vor", "\u00bfYa pagaste? Escribe tu c\u00f3digo de personalizaci\u00f3n"), row = mkEl("div", "vcode"), inp = mkEl("input"), ok = mkEl("button", "", "Desbloquear"), msg = mkEl("div");
        msg.id = "vmsg";
        inp.placeholder = "RK-XXXX-XXXX";
        inp.maxLength = 14;
        inp.autocomplete = "off";
        pay.onclick = () => {
            const u = window.RD_PAYPAL || "";
            if (!u || u.indexOf("TU_USUARIO") >= 0) {
                msg.textContent = "El pago a\u00fan no est\u00e1 configurado.";
                return;
            }
            window.open(u, "_blank", "noopener");
        };
        const go = () => {
            const k = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (vvalid(k)) {
                vsrv(k, "vip").then(er => er ? (msg.textContent = er) : vgrant(vfmt(k), false));
            }
            else
                msg.textContent = "C\u00f3digo incorrecto.";
        };
        ok.onclick = go;
        inp.addEventListener("keydown", e => {
            if (e.key === "Enter")
                go();
        });
        row.append(inp, ok);
        const ppb = mkEl("div"), use = vppLoad(ppb, msg, null, null, "vip") ? ppb : pay;
        c.append(ul, pr, vGate(use), mkEl("p", "vs", "Al pagar, tu c\u00f3digo aparece aqu\u00ed al instante y se desbloquea solo."), or, row, msg);
    }
    else {
        c.append(x, mkEl("h2", "", "\u2B50 Personalizar"), mkEl("p", "vs", "Tus ajustes se guardan en este navegador"));
        vcodeBox(c);
        const tabs = mkEl("div", "vtabs"), body = mkEl("div");
        ["Radio", "Caja", "Ajustes", "Orden", "Estilo", "Medidor", "Pinturas"].forEach((n, i) => {
            const b = mkEl("button", "vtab" + (i === vtab ? " on" : ""), n);
            b.onclick = () => {
                vtab = i;
                vipOpen();
            };
            tabs.appendChild(b);
        });
        const set = (k, v) => {
            cfg[k] = v;
            cfgSave();
            applyCfg();
        };
        if (vtab === 0) {
            body.append(mkEl("div", "vh", "MODELO DE RADIO"), chips([["orig", "DEH-4250BT"], ["m1", "MVH-S218BT"], ["m2", "DEH CD Bluetooth"], ["m3", "Alpine iDA-X305"], ["m4", "MVH-S215BT"], ["m5", "JVC XD-X280BT"], ["m6", "MVH-S215BT Spotify"], ["m7", "Alpine UTE-200BT"]], cfg.radio, k => {
                set("radio", k);
                if (MODELS[k])
                    setColor(MODELS[k].dc || 0, true);
            }));
            body.append(slider("Brillo del radio", .6, 1.4, .05, cfg.bri, x => set("bri", x), x => Math.round(x * 100) + "%"));
        }
        else if (vtab === 3) {
            const o = ordOf(cfg), list = mkEl("div", "vord");
            const mv = (i, d) => {
                const j = i + d;
                if (j < 0 || j >= o.length)
                    return;
                const a = o.slice();
                const x = a[i];
                a[i] = a[j];
                a[j] = x;
                cfg.order = a;
                cfgSave();
                applyCfg();
                vipOpen();
            };
            o.forEach((t, i) => {
                const r = mkEl("div", "vrow"), lab = t === "r" ? "\uD83D\uDCFB Radio" : (t[0] === "a" ? "\uD83C\uDF9B\uFE0F Pre Ateq " : "\uD83C\uDF9A\uFE0F EQ ") + (+t.slice(1) + 1);
                const up = mkEl("button", "vchip", "\u25B2"), dn = mkEl("button", "vchip", "\u25BC");
                up.onclick = () => mv(i, -1);
                dn.onclick = () => mv(i, 1);
                up.disabled = i === 0;
                dn.disabled = i === o.length - 1;
                r.append(mkEl("span", "", lab), up, dn);
                list.appendChild(r);
            });
            const rs = mkEl("button", "vrs", "Orden original");
            rs.onclick = () => {
                cfg.order = null;
                cfgSave();
                applyCfg();
                vipOpen();
            };
            body.append(mkEl("div", "vh", "ORDEN (DE ARRIBA A ABAJO)"), list, mkEl("p", "vs", "Usa las flechas para subir o bajar el radio, cada EQ y cada Pre Ateq. Si agregas m\u00e1s EQs, aparecen aqu\u00ed."), rs);
        }
        else if (vtab === 5) {
            const d = DBM.st, on = mkEl("label", "vtg"), onc = mkEl("input");
            onc.type = "checkbox";
            onc.checked = !!d.on;
            onc.onchange = () => DBM.setOn(onc.checked);
            on.append(onc, mkEl("span", "", "\uD83D\uDD0A Mostrar medidor de decibeles"));
            body.append(mkEl("div", "vh", "MEDIDOR DE DECIBELES"), on, slider("Calibraci\u00f3n (sube o baja la lectura)", -30, 30, 1, d.cal, x => DBM.setCal(x), x => (x > 0 ? "+" : "") + Math.round(x) + " dB"), mkEl("p", "vs", "Mide qu\u00e9 tan alto suenan los medios y agudos de la m\u00fasica de la app (los graves no cuentan). Puedes moverlo por la pantalla y ocultarlo con la \u2715. Los n\u00fameros son estimados: dependen del volumen de tu dispositivo y del equipo, y no sustituyen a un son\u00f3metro real."));
        }
        else if (vtab === 6)
            pinturaTab(body);
        else if (vtab === 4)
            estiloTab(body, set, cfg, vipOpen);
        else if (vtab === 1) {
            body.append(mkEl("div", "vh", "FORMA DE LA CAJITA"), chips([["cl", "Cl\u00e1sica"], ["sq", "Cuadrada"], ["round", "Redondeada"], ["bevel", "Biselada"], ["noears", "Sin orejas"], ["carbon", "Carbono"], ["neon", "Ne\u00f3n"], ["metal", "Metal cepillado"], ["double", "Doble marco"], ["wood", "Madera"], ["perf", "Rejilla"], ["chamfer", "Esquinas cortadas"], ["glass", "Cristal"]], cfg.shape, k => set("shape", k)), slider("Grosor del marco", 1.2, 4.6, .1, cfg.pad, x => set("pad", x), x => x.toFixed(1)));
        }
        else {
            body.append(mkEl("div", "vh", "RADIO"), slider("Volumen m\u00e1ximo del radio", 20, 100, 1, cfg.vmax, x => set("vmax", x), x => String(Math.round(x))), mkEl("div", "vh", "ECUALIZADORES"), slider("Potencia de los EQs", 1, 5, .1, cfg.eqx, x => set("eqx", x), x => "x" + x.toFixed(1)), mkEl("p", "vs", "Con potencia alta (x4 o m\u00e1s) puede distorsionar y sonar muy fuerte: baja el volumen antes de subirla."), slider("Precisi\u00f3n de las bandas (Q)", .5, 3, .1, cfg.q, x => set("q", x), x => x.toFixed(1)), slider("Brillo de las perillas", 0, 2.5, .1, cfg.glow, x => set("glow", x), x => Math.round(x * 100) + "%"));
            const tg = mkEl("label", "vtg"), cb = mkEl("input");
            cb.type = "checkbox";
            cb.checked = !!cfg.vals;
            cb.onchange = () => set("vals", cb.checked);
            tg.append(cb, mkEl("span", "", "Mostrar valores bajo las perillas"));
            const vt = mkEl("label", "vtg"), vc = mkEl("input"), vl = mkEl("span", "", "");
            vc.type = "checkbox";
            vc.checked = !!cfg.volt;
            const vtxt = () => {
                vl.textContent = "\u26A1 M\u00e1s voltaje: " + (cfg.volt ? "14.4V" : "12.6V");
            };
            vtxt();
            vc.onchange = () => {
                set("volt", vc.checked);
                vtxt();
                if (on)
                    ov(cfg.volt ? "14.4V" : "12.6V");
            };
            vt.append(vc, vl);
            body.append(vt, mkEl("p", "vs", "Sube el voltaje del radio de 12.6V a 14.4V (como con el motor encendido): m\u00e1s potencia de salida. Baja el volumen antes de activarlo."));
            const rs = mkEl("button", "vrs", "Restablecer todo");
            rs.onclick = () => {
                cfg = Object.assign({}, cfgD);
                cfgSave();
                applyCfg();
                vipOpen();
            };
            body.append(tg, rs);
        }
        c.append(tabs, body);
    }
    m.classList.add("show");
}

$("vipb") && $("vipb").addEventListener("click", vipOpen);

function donOpen() {
    let m = $("donm");
    if (!m) {
        m = mkEl("div", "vm");
        m.id = "donm";
        m.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") m.classList.remove("show"); });
        m.addEventListener("pointerdown", e => { if (e.target === m) m.classList.remove("show"); });
        document.body.appendChild(m);
    }
    m.textContent = "";
    const c = mkEl("div", "vc"), x = mkEl("button", "vx", "\u2715"), row = mkEl("div", "donamts"), capBox = mkEl("div", "vcapw"), msg = mkEl("div"), pp = mkEl("div"), inp = mkEl("input");
    x.onclick = () => m.classList.remove("show");
    msg.className = "vmsg";
    inp.type = "number"; inp.min = "5"; inp.max = "500"; inp.step = "1"; inp.placeholder = "Otro monto (USD)";
    let amt = 5;
    const bs = [];
    [5, 10, 20, 50].forEach(v => {
        const b = mkEl("button", v === amt ? "on" : "", "$" + v);
        b.type = "button";
        b.onclick = () => { amt = v; inp.value = ""; bs.forEach(o => o.classList.toggle("on", o === b)); };
        bs.push(b); row.appendChild(b);
    });
    inp.oninput = () => { const v = parseFloat(inp.value); if (v > 0) { amt = v; bs.forEach(o => o.classList.remove("on")); } };
    c.append(x, mkEl("h2", "", "\uD83D\uDC9A Donaci\u00f3n"), mkEl("p", "vs", "Apoya este proyecto. \u00a1Gracias por ayudar a seguir haci\u00e9ndolo posible! Para donar necesitas iniciar sesi\u00f3n (m\u00ednimo $5)."), row, inp, capBox, pp, msg);
    vCaptcha(capBox);
    if (!donLoad(pp, msg, () => amt)) {
        const u = String(window.RD_PAYPAL || "").replace(/\/\d+[A-Za-z]{3}$/, "");
        if (!u || u.indexOf("TU_USUARIO") >= 0) return;
        const l = mkEl("button", "vpay", "Donar con PayPal");
        l.onclick = () => window.open(u, "_blank", "noopener");
        pp.appendChild(l);
    }
    m.appendChild(c);
    m.classList.add("show");
}

const donbEl = $("donb"); if (donbEl) donbEl.addEventListener("click", donOpen);

applyCfg();

;
/**
 * Pinturas VIP (pestaña "Pinturas" de Personalización)
 * Acabados para la caja del radio: degradado de 2 colores, degradado avanzado, multicolor, gotas de pintura, perlado y camaleón.
 *
 * - Se pintan sobre la caja REAL (#case): solo su fondo. El radio, los botones, las orejas, los bordes y el fondo de la web no se tocan.
 * - Cada acabado guarda su propia configuración dentro de cfg.paint (el mismo almacenamiento de Personalización, que viaja con la cuenta).
 * - Solo VIP: applyCfg usa cfg únicamente si hay VIP, y el servidor (SQL-PINTURAS.sql) borra la pintura al guardar si la cuenta no es VIP.
 * - Vista previa: lo que eliges se ve al instante en el radio; solo se guarda al pulsar "Aplicar y guardar". Al cerrar sin guardar se restaura.
 * - Rendimiento: todo es CSS (capas de gradiente y un SVG pequeño para las gotas). Solo el camaleón se anima, con un movimiento lento de fondo.
 */

const PT_TIPOS = [
    ["grad2", "Degradado", "Dos colores que se mezclan suavemente."],
    ["gradx", "Degradado avanzado", "De 2 a 5 colores, con orden, ángulo y suavidad."],
    ["multi", "Multicolor", "De 3 a 6 colores en franjas, bloques o mezcla suave."],
    ["drops", "Gotas de pintura", "Color de fondo con gotas y chorreras de distintos tamaños."],
    ["pearl", "Perlado", "Pintura perlada de auto: reflejos suaves y profundidad."],
    ["cham", "Camaleón", "Cambia de tono entre dos o tres colores (animación lenta)."]
];
const PT_D = {
    t: "",
    grad2: { a: "#ff2d2d", b: "#1f6bff", dir: "135", int: 1 },
    gradx: { cols: ["#ff2d2d", "#ff8a1f", "#1f6bff"], ang: 135, smooth: 70 },
    multi: { n: 4, cols: ["#ff2d2d", "#ff8a1f", "#f5d90a", "#1fc24a", "#1f6bff", "#b46bff"], mode: "franjas", dist: 50 },
    drops: { base: "#1b1b1c", drop: "#ff2d2d", n: 26, size: 1, seed: 7 },
    pearl: { base: "#d9dcec", int: .6 },
    cham: { c1: "#1f6bff", c2: "#9b3bff", c3: "#00d4a0", use3: true, int: .8, speed: 5 },
    ts: 0
};

// ---------- utilidades ----------
const ptHex = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c.toLowerCase() : d);
const ptNum = (x, a, b, d) => { x = +x; return isNaN(x) ? d : Math.max(a, Math.min(b, x)); };
const ptRgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const ptToHex = r => "#" + r.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const ptMix = (a, b, t) => { const x = ptRgb(a), y = ptRgb(b); return ptToHex(x.map((v, i) => v + (y[i] - v) * t)); };
const ptLight = (c, t) => ptMix(c, "#ffffff", t), ptDark = (c, t) => ptMix(c, "#000000", t);
const ptRgba = (c, a) => { const r = ptRgb(c); return "rgba(" + r[0] + "," + r[1] + "," + r[2] + "," + a + ")"; };

/* Devuelve la pintura con todo validado (nunca se confía en lo guardado). */
function ptClean(p) {
    const o = JSON.parse(JSON.stringify(PT_D)), s = p && typeof p === "object" ? p : {};
    o.t = PT_TIPOS.some(x => x[0] === s.t) ? s.t : "";
    const g = s.grad2 || {};
    o.grad2 = { a: ptHex(g.a, o.grad2.a), b: ptHex(g.b, o.grad2.b), dir: ["180", "90", "135", "45"].indexOf(String(g.dir)) >= 0 ? String(g.dir) : "135", int: ptNum(g.int, .2, 1, 1) };
    const x = s.gradx || {}, xc = (Array.isArray(x.cols) ? x.cols : []).map(c => ptHex(c, "")).filter(Boolean).slice(0, 5);
    o.gradx = { cols: xc.length >= 2 ? xc : PT_D.gradx.cols.slice(), ang: ptNum(x.ang, 0, 360, 135), smooth: ptNum(x.smooth, 0, 100, 70) };
    const m = s.multi || {}, mc = (Array.isArray(m.cols) ? m.cols : []).map((c, i) => ptHex(c, PT_D.multi.cols[i]));
    o.multi = { n: Math.round(ptNum(m.n, 3, 6, 4)), cols: PT_D.multi.cols.map((d, i) => mc[i] || d), mode: ["franjas", "bloques", "mezcla"].indexOf(m.mode) >= 0 ? m.mode : "franjas", dist: ptNum(m.dist, 0, 100, 50) };
    const d = s.drops || {};
    o.drops = { base: ptHex(d.base, o.drops.base), drop: ptHex(d.drop, o.drops.drop), n: Math.round(ptNum(d.n, 5, 60, 26)), size: ptNum(d.size, .6, 1.6, 1), seed: Math.round(ptNum(d.seed, 1, 99999, 7)) };
    const pe = s.pearl || {};
    o.pearl = { base: ptHex(pe.base, o.pearl.base), int: ptNum(pe.int, .2, 1, .6) };
    const c = s.cham || {};
    o.cham = { c1: ptHex(c.c1, o.cham.c1), c2: ptHex(c.c2, o.cham.c2), c3: ptHex(c.c3, o.cham.c3), use3: c.use3 !== false, int: ptNum(c.int, .3, 1, .8), speed: Math.round(ptNum(c.speed, 1, 10, 5)) };
    o.ts = ptNum(s.ts, 0, 4e12, 0);
    return o;
}

/* Colores con transición suave (suavidad 0 = casi corte, 1 = muy gradual): se calculan paradas intermedias. */
function ptSuave(cols, smooth) {
    const n = cols.length, out = [], w = .12 + .88 * smooth;
    for (let i = 0; i < n - 1; i++) {
        const a = i / (n - 1) * 100, b = (i + 1) / (n - 1) * 100;
        for (let k = 0; k <= 8; k++) {
            const t = k / 8, u = Math.max(0, Math.min(1, (t - .5) / w + .5)), e = u * u * (3 - 2 * u);
            if (i > 0 && k === 0) continue;
            out.push(ptMix(cols[i], cols[i + 1], e) + " " + (a + (b - a) * t).toFixed(1) + "%");
        }
    }
    return out.join(",");
}

/* Brillo suave que comparten todas las pinturas (parecido al de la caja normal). */
const PT_BRILLO = "linear-gradient(155deg,rgba(255,255,255,.2),rgba(255,255,255,0) 42%,rgba(0,0,0,.22))";

// ---------- gotas (SVG pequeño) ----------
function ptRand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function ptGotas(d) {
    const W = 1000, H = 625, r = ptRand(d.seed), f = [];
    f.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice"><rect width="' + W + '" height="' + H + '" fill="' + d.base + '"/>');
    const sombra = ptDark(d.drop, .45), luz = ptLight(d.drop, .55);
    for (let i = 0; i < d.n; i++) {
        const x = 20 + r() * (W - 40), y = 15 + r() * (H - 30), rad = (6 + Math.pow(r(), 2.4) * 40) * d.size;
        const pts = [], k = 9;
        for (let j = 0; j < k; j++) { const a = j / k * Math.PI * 2, q = rad * (.82 + r() * .34); pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q * (.9 + r() * .2)]); }
        let dpath = "M" + ((pts[0][0] + pts[k - 1][0]) / 2).toFixed(1) + "," + ((pts[0][1] + pts[k - 1][1]) / 2).toFixed(1);
        for (let j = 0; j < k; j++) { const a = pts[j], b = pts[(j + 1) % k]; dpath += " Q" + a[0].toFixed(1) + "," + a[1].toFixed(1) + " " + ((a[0] + b[0]) / 2).toFixed(1) + "," + ((a[1] + b[1]) / 2).toFixed(1); }
        f.push('<path d="' + dpath + 'Z" fill="' + sombra + '" opacity=".55" transform="translate(' + (rad * .12).toFixed(1) + "," + (rad * .16).toFixed(1) + ')"/>');
        // chorrera: las gotas grandes escurren hacia abajo
        if (rad > 24 * d.size && r() < .6) {
            const len = rad * (1.4 + r() * 2.8), wd = rad * (.28 + r() * .16), x0 = x + (r() - .5) * rad * .5;
            f.push('<path d="M' + (x0 - wd).toFixed(1) + "," + y.toFixed(1) + " L" + (x0 - wd * .8).toFixed(1) + "," + (y + len).toFixed(1) + " a" + (wd * .85).toFixed(1) + "," + (wd * .85).toFixed(1) + " 0 1 0 " + (wd * 1.6).toFixed(1) + ",0 L" + (x0 + wd).toFixed(1) + "," + y.toFixed(1) + 'Z" fill="' + d.drop + '"/>');
            f.push('<circle cx="' + x0.toFixed(1) + '" cy="' + (y + len + wd * .6).toFixed(1) + '" r="' + (wd * 1.05).toFixed(1) + '" fill="' + d.drop + '"/>');
        }
        f.push('<path d="' + dpath + 'Z" fill="' + d.drop + '"/>');
        f.push('<ellipse cx="' + (x - rad * .3).toFixed(1) + '" cy="' + (y - rad * .35).toFixed(1) + '" rx="' + (rad * .26).toFixed(1) + '" ry="' + (rad * .15).toFixed(1) + '" fill="' + luz + '" opacity=".6" transform="rotate(-25 ' + (x - rad * .3).toFixed(1) + " " + (y - rad * .35).toFixed(1) + ')"/>');
    }
    f.push("</svg>");
    return 'url("data:image/svg+xml,' + encodeURIComponent(f.join("")) + '")';
}

// ---------- CSS de cada acabado ----------
/* Devuelve { img, size, anim } listos para las variables --pti, --pts y --ptd. */
function ptCss(p, tipo) {
    const t = tipo || p.t;
    if (t === "grad2") {
        const g = p.grad2, mid = ptMix(g.a, g.b, .5), a = ptMix(mid, g.a, g.int), b = ptMix(mid, g.b, g.int);
        return { img: PT_BRILLO + ",linear-gradient(" + g.dir + "deg," + a + "," + b + ")", size: "100% 100%", anim: 0 };
    }
    if (t === "gradx") {
        const g = p.gradx;
        return { img: PT_BRILLO + ",linear-gradient(" + Math.round(g.ang) + "deg," + ptSuave(g.cols, g.smooth / 100) + ")", size: "100% 100%", anim: 0 };
    }
    if (t === "multi") {
        const m = p.multi, cols = m.cols.slice(0, m.n), n = cols.length;
        if (m.mode === "mezcla") {
            const pos = [[15, 20], [85, 25], [25, 88], [82, 82], [50, 50], [50, 8]];
            const capas = cols.map((c, i) => "radial-gradient(ellipse at " + pos[i][0] + "% " + pos[i][1] + "%," + ptRgba(c, .9) + ",rgba(0,0,0,0) 62%)");
            return { img: PT_BRILLO + "," + capas.join(",") + "," + "linear-gradient(120deg," + ptSuave(cols, .9) + ")", size: "100% 100%", anim: 0 };
        }
        const w = cols.map((c, i) => Math.max(.2, 1 + (m.dist - 50) / 50 * (i / (n - 1) - .5) * 1.7)), tot = w.reduce((s, v) => s + v, 0);
        let acc = 0;
        const stops = cols.map((c, i) => { const a = acc / tot * 100; acc += w[i]; return c + " " + a.toFixed(1) + "% " + (acc / tot * 100).toFixed(1) + "%"; }).join(",");
        if (m.mode === "franjas") return { img: PT_BRILLO + ",linear-gradient(118deg," + stops + ")", size: "100% 100%", anim: 0 };
        const rot = cols.slice(Math.ceil(n / 2)).concat(cols.slice(0, Math.ceil(n / 2)));
        let acc2 = 0;
        const wr = rot.map((c, i) => Math.max(.2, 1 + (m.dist - 50) / 50 * (i / (n - 1) - .5) * 1.7)), tr = wr.reduce((s, v) => s + v, 0);
        const stops2 = rot.map((c, i) => { const a = acc2 / tr * 100; acc2 += wr[i]; return c + " " + a.toFixed(1) + "% " + (acc2 / tr * 100).toFixed(1) + "%"; }).join(",");
        return { img: PT_BRILLO + ",linear-gradient(90deg," + stops + "),linear-gradient(90deg," + stops2 + ")", size: "100% 100%,100% 50%,100% 50%", pos: "0 0,0 0,0 100%", anim: 0 };
    }
    if (t === "drops") return { img: PT_BRILLO + "," + ptGotas(p.drops), size: "100% 100%,cover", anim: 0 };
    if (t === "pearl") {
        const q = p.pearl, i = q.int, b = q.base, tinte = ptMix(b, "#a8c8ff", .5), calido = ptMix(b, "#ffd6ee", .5);
        return {
            img: "radial-gradient(ellipse at 22% 14%," + ptRgba("#ffffff", .5 * i) + "," + ptRgba("#ffffff", 0) + " 52%)," +
                "radial-gradient(ellipse at 84% 88%," + ptRgba(tinte, .55 * i) + "," + ptRgba(tinte, 0) + " 55%)," +
                "radial-gradient(ellipse at 78% 18%," + ptRgba(calido, .45 * i) + "," + ptRgba(calido, 0) + " 45%)," +
                "linear-gradient(112deg,rgba(255,255,255,0) 36%," + ptRgba("#ffffff", .22 * i) + " 49%,rgba(255,255,255,0) 62%)," +
                "linear-gradient(160deg," + ptLight(b, .22) + "," + b + " 48%," + ptDark(b, .3) + ")",
            size: "100% 100%", anim: 0
        };
    }
    if (t === "cham") {
        const c = p.cham, k = c.int, cs = [c.c1, c.c2].concat(c.use3 ? [c.c3] : []), va = cs.map(x => ptMix(ptMix(cs[0], cs[cs.length - 1], .5), x, k));
        const lista = va.concat([va[0]]);
        return {
            img: "radial-gradient(ellipse at 28% 16%,rgba(255,255,255,.34),rgba(255,255,255,0) 50%),linear-gradient(115deg," + lista.join(",") + ")",
            size: "100% 100%,300% 100%", anim: 34 - 3 * c.speed
        };
    }
    return null;
}
/* Pone o quita una pintura en un elemento (la caja del radio o una muestra). */
function ptPoner(el, p, tipo) {
    if (!el) return;
    const t = tipo || (p && p.t), r = t && p ? ptCss(p, t) : null;
    if (!r) { delete el.dataset.paint; ["--pti", "--pts", "--ptp", "--ptd"].forEach(k => el.style.removeProperty(k)); return; }
    el.dataset.paint = t;
    el.style.setProperty("--pti", r.img);
    el.style.setProperty("--pts", r.size);
    el.style.setProperty("--ptp", r.pos || "center");
    el.style.setProperty("--ptd", r.anim ? r.anim + "s" : "0s");
}

/* Lo llama applyCfg: solo pinta si hay VIP (c = cfg si hay VIP, cfgD si no). */
function applyPintura(c) {
    const cs = document.getElementById("case");
    if (!cs) return;
    const p = c && c.paint ? ptClean(c.paint) : null;
    ptPoner(cs, p && p.t ? p : null);
}

// ---------- pestaña del panel ----------
function pinturaTab(body) {
    const base = (typeof cfg !== "undefined" && cfg.paint) ? ptClean(cfg.paint) : ptClean(null);
    let draft = ptClean(base), guardado = JSON.stringify(ptClean(base));
    const cont = mkEl("div"), estado = mkEl("p", "vs", "");
    const cambiado = () => JSON.stringify(Object.assign({}, ptClean(draft), { ts: 0 })) !== JSON.stringify(Object.assign({}, ptClean(JSON.parse(guardado)), { ts: 0 }));
    const msg = (t) => { estado.textContent = t; };
    const vista = () => {
        ptPoner(document.getElementById("case"), draft.t ? draft : null);
        cont.querySelectorAll(".ptsw").forEach(s => ptPoner(s, draft, s.dataset.k));
        msg(cambiado() ? "👁 Vista previa (sin guardar). Pulsa «Aplicar y guardar» para conservarla." : (draft.t ? "✔ Pintura guardada en tu cuenta." : "Sin pintura: se ve la caja normal."));
    };
    const fila = (lab, val, fn) => { const r = mkEl("label", "vtg"), i = mkEl("input"); i.type = "color"; i.value = val; i.oninput = () => { fn(i.value); vista(); }; r.append(i, mkEl("span", "", lab)); return r; };
    const cols = (arr, n0, onchange) => { const w = mkEl("div"); arr.slice(0, n0).forEach((c, i) => w.appendChild(fila("Color " + (i + 1), c, v => { arr[i] = v; }))); return w; };

    function controles() {
        const w = mkEl("div", "ptctl"), t = draft.t;
        if (!t) { w.appendChild(mkEl("p", "vs", "Elige un acabado para ver cómo queda en tu radio.")); return w; }
        if (t === "grad2") {
            const g = draft.grad2;
            w.append(fila("Primer color", g.a, v => { g.a = v; }), fila("Segundo color", g.b, v => { g.b = v; }),
                chips([["180", "Vertical"], ["90", "Horizontal"], ["135", "Diagonal"], ["45", "Diagonal inversa"]], g.dir, k => { g.dir = k; vista(); }),
                slider("Intensidad", 20, 100, 1, Math.round(g.int * 100), x => { g.int = x / 100; vista(); }, x => Math.round(x) + "%"));
        } else if (t === "gradx") {
            const g = draft.gradx, lista = mkEl("div");
            const pinta = () => {
                lista.textContent = "";
                g.cols.forEach((c, i) => {
                    const r = mkEl("div", "vrow"), ci = mkEl("input"), up = mkEl("button", "vchip", "▲"), dn = mkEl("button", "vchip", "▼"), q = mkEl("button", "vchip", "✕");
                    ci.type = "color"; ci.value = c; ci.oninput = () => { g.cols[i] = ci.value; vista(); };
                    up.onclick = () => { if (i) { [g.cols[i - 1], g.cols[i]] = [g.cols[i], g.cols[i - 1]]; pinta(); vista(); } };
                    dn.onclick = () => { if (i < g.cols.length - 1) { [g.cols[i + 1], g.cols[i]] = [g.cols[i], g.cols[i + 1]]; pinta(); vista(); } };
                    q.onclick = () => { if (g.cols.length > 2) { g.cols.splice(i, 1); pinta(); vista(); } };
                    up.disabled = !i; dn.disabled = i === g.cols.length - 1; q.disabled = g.cols.length <= 2;
                    r.append(ci, mkEl("span", "", "Color " + (i + 1)), up, dn, q); lista.appendChild(r);
                });
                if (g.cols.length < 5) { const a = mkEl("button", "vrs", "+ Añadir color"); a.onclick = () => { g.cols.push(ptMix(g.cols[g.cols.length - 1], "#ffffff", .4)); pinta(); vista(); }; lista.appendChild(a); }
            };
            pinta();
            w.append(lista, slider("Dirección (ángulo)", 0, 360, 1, g.ang, x => { g.ang = x; vista(); }, x => Math.round(x) + "°"), slider("Suavidad de la transición", 0, 100, 1, g.smooth, x => { g.smooth = x; vista(); }, x => Math.round(x) + "%"));
        } else if (t === "multi") {
            const m = draft.multi, lista = mkEl("div");
            const pinta = () => { lista.textContent = ""; lista.appendChild(cols(m.cols, m.n, null)); };
            pinta();
            w.append(mkEl("div", "vh", "CANTIDAD DE COLORES"), chips([["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"]], String(m.n), k => { m.n = +k; pinta(); vista(); }), lista,
                chips([["franjas", "Franjas"], ["bloques", "Bloques"], ["mezcla", "Mezcla suave"]], m.mode, k => { m.mode = k; vista(); }),
                slider("Distribución de los colores", 0, 100, 1, m.dist, x => { m.dist = x; vista(); }, x => Math.round(x) + "%"));
        } else if (t === "drops") {
            const d = draft.drops, rd = mkEl("button", "vrs", "🔀 Redistribuir las gotas");
            rd.onclick = () => { d.seed = 1 + Math.floor(Math.random() * 99998); vista(); };
            w.append(fila("Color de fondo", d.base, v => { d.base = v; }), fila("Color de las gotas", d.drop, v => { d.drop = v; }),
                slider("Cantidad de gotas", 5, 60, 1, d.n, x => { d.n = Math.round(x); vista(); }, x => String(Math.round(x))), slider("Tamaño de las gotas", .6, 1.6, .05, d.size, x => { d.size = x; vista(); }, x => Math.round(x * 100) + "%"), rd);
        } else if (t === "pearl") {
            const q = draft.pearl;
            w.append(fila("Color base", q.base, v => { q.base = v; }), slider("Intensidad del efecto", 20, 100, 1, Math.round(q.int * 100), x => { q.int = x / 100; vista(); }, x => Math.round(x) + "%"));
        } else if (t === "cham") {
            const c = draft.cham, tg = mkEl("label", "vtg"), cb = mkEl("input"), c3 = fila("Tercer color", c.c3, v => { c.c3 = v; });
            cb.type = "checkbox"; cb.checked = c.use3; c3.style.display = c.use3 ? "" : "none";
            cb.onchange = () => { c.use3 = cb.checked; c3.style.display = c.use3 ? "" : "none"; vista(); };
            tg.append(cb, mkEl("span", "", "Usar un tercer color"));
            w.append(fila("Color principal", c.c1, v => { c.c1 = v; }), fila("Segundo color", c.c2, v => { c.c2 = v; }), tg, c3,
                slider("Intensidad del efecto", 30, 100, 1, Math.round(c.int * 100), x => { c.int = x / 100; vista(); }, x => Math.round(x) + "%"),
                slider("Velocidad de la transición", 1, 10, 1, c.speed, x => { c.speed = Math.round(x); vista(); }, x => Math.round(x) + " / 10"),
                mkEl("p", "vs", "Es una animación de colores en 2D (no un efecto óptico real según el ángulo)."));
        }
        return w;
    }

    function dibuja() {
        cont.textContent = "";
        const top = mkEl("div", "vh", "PINTURAS VIP"), badge = mkEl("span", "ptvip", "⭐ Exclusivo VIP");
        top.appendChild(badge);
        const rej = mkEl("div", "ptgrid");
        PT_TIPOS.forEach(([k, n, d]) => {
            const c = mkEl("button", "ptcard" + (draft.t === k ? " on" : "")), sw = mkEl("div", "ptsw");
            c.type = "button"; sw.dataset.k = k;
            c.append(sw, mkEl("b", "", n), mkEl("small", "", d));
            c.onclick = () => { draft.t = k; dibuja(); vista(); };
            rej.appendChild(c);
        });
        const acc = mkEl("div", "ptacc"), ok = mkEl("button", "vrs ptok", "✔ Aplicar y guardar"), no = mkEl("button", "vrs", "✖ Quitar pintura"), rv = mkEl("button", "vrs", "↺ Descartar cambios");
        ok.onclick = () => {
            if (!vip) { msg("Las pinturas son solo para VIP."); return; }
            const p = ptClean(draft); p.ts = Date.now();
            cfg.paint = p.t ? p : null; cfgSave(); applyCfg();
            guardado = JSON.stringify(ptClean(p)); draft = ptClean(p); vista();
        };
        no.onclick = () => { draft.t = ""; cfg.paint = null; cfgSave(); applyCfg(); guardado = JSON.stringify(ptClean(draft)); dibuja(); vista(); };
        rv.onclick = () => { draft = ptClean(JSON.parse(guardado)); dibuja(); vista(); };
        acc.append(ok, rv, no);
        cont.append(top, rej, controles(), estado, acc);
    }
    dibuja(); vista();
    body.appendChild(cont);
}

/* Al cerrar el panel sin guardar, la caja vuelve a su pintura guardada. */
(() => {
    const cerrar = vipClose;
    vipClose = function () { cerrar(); try { applyPintura(vip ? cfg : cfgD); } catch (e) { } };
})();

/* Primer pintado: applyCfg corri\u00f3 antes de que este archivo terminara de cargar, as\u00ed que se aplica aqu\u00ed la pintura guardada. */
try { applyPintura(vip ? cfg : cfgD); } catch (e) { }

;
/**
 * Pase "Kitipo y Bajos"
 * Desbloquea los chucheros de 8, 10 y 12 (el de 6 es gratis y viene por defecto).
 * Los bajos aparecen como "próximamente". Cuesta $5, pero durante la beta (hasta RD_BETA_FIN) es gratis.
 */

const KITOP = [6, 8, 10, 12];
let kit = true, kitnew = false;

try {
    kit = true;
}
catch (e) { }

/* La beta se mide con la hora del SERVIDOR (api/hora), no con el reloj del aparato: cambiar la hora del equipo no alarga la beta.
   Sin respuesta del servidor la beta se considera terminada. */
let srvSkew = null;
const nowSrv = () => Date.now() + (srvSkew || 0);
const betaOn = () => srvSkew !== null && nowSrv() < (window.RD_BETA_FIN || 0);
(() => {
    if (Date.now() > (window.RD_BETA_FIN || 0) + 864e5 * 400) return;
    const u = (window.RD_API_PAGO || "/api/pago").replace(/pago$/, "hora"), t0 = Date.now();
    fetch(u, { cache: "no-store" }).then(r => r.json()).then(j => {
        if (j && typeof j.t === "number") { srvSkew = j.t - (t0 + Date.now()) / 2; if (betaOn()) { try { if (typeof spkBuild === "function") spkBuild(); } catch (e) { } } }
    }).catch(() => { });
})();
const kitOK = () => kit || betaOn();

function betaTxt() {
    const fin = window.RD_BETA_FIN || 0, ms = Math.max(0, fin - nowSrv()), z = "America/Santo_Domingo";
    const d = Math.max(1, Math.ceil(ms / 864e5)), h = Math.floor(ms / 36e5), mi = Math.floor(ms % 36e5 / 6e4);
    const dia = new Date(fin).toLocaleDateString("es", { day: "numeric", month: "long", timeZone: z }) + " a las " + new Date(fin).toLocaleTimeString("es", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: z });
    return { d, dia, left: ms < 864e5 ? (h ? h + " h " + mi + " min" : mi + " min") : "" };
}

function kitSave(code) {
    kit = true;
    try {
        localStorage.setItem("pioneerKIT", "1");
        localStorage.setItem("pioneerKITcode", code);
    }
    catch (e) { }
}

/* El código admin desbloquea los dos pases sin abrir ventanas. */
function kitAdmin() {
    kitSave("ADMIN");
}

function kitGrant(code, fresh) {
    kitnew = !!fresh;
    kitSave(code);
    kitOpen();
}

/* Chucheros apilados: cada tamaño tiene un máximo (6: 2, 8: 4, 10: 2, 12: 3). Los nuevos se apilan al lado de los demás. */
function spkChips(box, cb) {
    box.textContent = "";
    KITOP.forEach(n => {
        const lock = n !== 6 && !kitOK(), r = mkEl("div", "skr"), mn = mkEl("button", "", "\u2212"), pl = mkEl("button", "", "+"), c = spkCount(n);
        mn.type = pl.type = "button";
        mn.disabled = c <= 0;
        pl.disabled = lock || c >= SPKMAX[n];
        mn.setAttribute("aria-label", "Quitar chuchero de " + n);
        pl.setAttribute("aria-label", "Agregar chuchero de " + n);
        mn.onclick = () => { spkDel(n); cb ? cb() : spkChips(box); };
        pl.onclick = () => { spkAdd(n); cb ? cb() : spkChips(box); };
        const b = mkEl("b", "", (lock ? "\uD83D\uDD12 " : "") + "Chuchero de " + n + "\u2033");
        b.appendChild(mkEl("small", "", lock ? "con Kitipo y Bajos" : n === 6 && !kitOK() ? "gratis \u00b7 m\u00e1x. " + SPKMAX[n] : "m\u00e1x. " + SPKMAX[n]));
        r.append(b, mn, mkEl("span", "", c + "/" + SPKMAX[n]), pl);
        box.appendChild(r);
    });
}

/* Orden de la fila, de izquierda a derecha: chucheros y tablas juntos. */
function rowOrdUI(box, cb) {
    box.textContent = "";
    const it = rowItems();
    if (it.length < 2)
        return;
    box.appendChild(mkEl("div", "vh", "ORDEN (IZQUIERDA \u2192 DERECHA)"));
    it.forEach((x, i) => {
        const r = mkEl("div", "vrow"), lf = mkEl("button", "vchip", "\u25C0"), rg = mkEl("button", "vchip", "\u25B6");
        lf.type = rg.type = "button";
        lf.disabled = i === 0;
        rg.disabled = i === it.length - 1;
        lf.setAttribute("aria-label", "Mover a la izquierda");
        rg.setAttribute("aria-label", "Mover a la derecha");
        lf.onclick = () => { rowMove(i, -1); cb(); };
        rg.onclick = () => { rowMove(i, 1); cb(); };
        r.append(mkEl("span", "", (i + 1) + ". " + (x.k === "s" ? "Chuchero de " + x.n : "Tabla " + TBLNOM[x.t] + " de " + x.n) + "\u2033"), lf, rg);
        box.appendChild(r);
    });
    box.appendChild(mkEl("p", "vs", "El primero queda a la izquierda."));
}

/* Bajos: del m\u00e1s chico al m\u00e1s grande. Tocar el elegido lo quita. */
function bajoChips(box) {
    box.textContent = "";
    BAJOS.forEach((j, i) => {
        const lock = j.id !== "12" && !kitOK(), b = mkEl("button", "bjo" + (j.id === bajoId ? " on" : "") + (lock ? " lock" : "")), im = document.createElement("img");
        b.type = "button";
        im.src = "assets/img/bajos/" + j.id + ".webp";
        im.alt = "";
        b.append(im, document.createTextNode((lock ? "\uD83D\uDD12 " : "") + j.nom), mkEl("i", "", lock ? "con Kitipo" : i ? "nivel " + (i + 1) : "GRATIS"));
        b.onclick = () => {
            if (lock)
                return; setBajo(j.id === bajoId ? "" : j.id, true); bajoChips(box); };
        box.appendChild(b);
    });
}

/* Tablas: 3 tipos por tama\u00f1o (6, 8, 10 y 12). M\u00e1ximo 4 de cada tipo. Solo las de 6 son gratis. */
let kitTab = 0, tbSize = 6;

function tbChips(box, cb) {
    box.textContent = "";
    const lock = tbSize !== 6 && !kitOK();
    Object.keys(TBLM).forEach(k => {
        const t = +k, c = tbCount(t, tbSize), r = mkEl("div", "skr tbk"), mn = mkEl("button", "", "\u2212"), pl = mkEl("button", "", "+"), im = document.createElement("img");
        im.src = TBLIMGS[t];
        im.alt = "";
        im.draggable = false;
        mn.type = pl.type = "button";
        mn.disabled = c <= 0;
        pl.disabled = lock || c >= TBLMAX;
        mn.setAttribute("aria-label", "Quitar " + TBLNOM[t] + " de " + tbSize);
        pl.setAttribute("aria-label", "Agregar " + TBLNOM[t] + " de " + tbSize);
        mn.onclick = () => { tbDel(t, tbSize); cb(); };
        pl.onclick = () => { tbAdd(t, tbSize); cb(); };
        const b = mkEl("b", "", (lock ? "\uD83D\uDD12 " : "") + TBLNOM[t] + " de " + tbSize + "\u2033");
        b.appendChild(mkEl("small", "", lock ? "con Kitipo y Bajos" : TBLDES[t] + " \u00b7 m\u00e1x. " + TBLMAX));
        r.append(im, b, mn, mkEl("span", "", c + "/" + TBLMAX), pl);
        box.appendChild(r);
    });
}


/* El panel va por categor\u00edas: Chucheros, Bajos y Tablas. */
function kitSections(c) {
    const tabs = mkEl("div", "vtabs");
    ["Chucheros", "Bajos", "Tablas"].forEach((n, i) => {
        const b = mkEl("button", "vtab" + (i === kitTab ? " on" : ""), n);
        b.type = "button";
        b.onclick = () => { kitTab = i; kitOpen(); };
        tabs.appendChild(b);
    });
    c.appendChild(tabs);
    if (kitTab === 0) {
        c.appendChild(mkEl("div", "vh", "CHUCHEROS (ARRIBA)"));
        const box = mkEl("div", "vch2"), ob = mkEl("div");
        const rf = () => { spkChips(box, rf); rowOrdUI(ob, rf); };
        rf();
        c.append(box, ob, mkEl("p", "vs", "Al agregar uno se apila al lado de los otros, delante de los bajos. Cambia su color en Opciones."));
    }
    else if (kitTab === 1) {
        c.appendChild(mkEl("div", "vh", "BAJOS (ATR\u00c1S DE LOS CHUCHEROS)"));
        const bx = mkEl("div", "bjg");
        bajoChips(bx);
        c.append(bx, mkEl("p", "vs", "Cuanto m\u00e1s grande es la categor\u00eda, m\u00e1s sube tu sub level y m\u00e1s mueve el blur. Los paneles azules del 2-18 y el 2-21 toman el color que elijas en Opciones."));
    }
    else {
        c.appendChild(mkEl("div", "vh", "TABLAS (JUNTO A LOS CHUCHEROS)" + (kitOK() ? "" : " \u00b7 LAS DE 6\u2033 SON GRATIS")));
        const sz = mkEl("div", "vtabs tbsz"), box = mkEl("div", "vch2"), ob = mkEl("div");
        const rf = () => { tbChips(box, rf); rowOrdUI(ob, rf); [...sz.children].forEach((b, i) => b.classList.toggle("on", TBLSIZES[i] === tbSize)); };
        TBLSIZES.forEach(n => {
            const b = mkEl("button", "vtab", (n !== 6 && !kitOK() ? "\uD83D\uDD12 " : "") + n + "\u2033");
            b.type = "button";
            b.setAttribute("aria-label", "Tablas de " + n);
            b.onclick = () => { tbSize = n; rf(); };
            sz.appendChild(b);
        });
        rf();
        c.append(sz, box, ob, mkEl("p", "vs", "Hasta " + TBLMAX + " tablas de cada tipo en cada tama\u00f1o. El color del panel es el de Chucheros y el de los drivers lo cambias en Opciones."));
    }
}

function kitClose() {
    $("kitm").classList.remove("show");
}

function kitCodeBox(c) {
    let k = "";
    try {
        k = localStorage.getItem("pioneerKITcode") || "";
    }
    catch (e) { }
    if (!k)
        return;
    if (k === "ADMIN") {
        const a = mkEl("div", "vcb new");
        a.appendChild(mkEl("div", "", "\uD83D\uDD11 Acceso admin activo: Kitipo y Bajos gratis"));
        c.appendChild(a);
        return;
    }
    const b = mkEl("div", "vcb" + (kitnew ? " new" : "")), cp = mkEl("button", "", "Copiar");
    cp.onclick = () => {
        try {
            navigator.clipboard.writeText(k);
            cp.textContent = "Copiado";
        }
        catch (e) { }
    };
    b.append(mkEl("div", "", kitnew ? "\u2705 \u00a1Pago recibido! Guarda tu c\u00f3digo de Kitipo y Bajos:" : "Tu c\u00f3digo de Kitipo y Bajos:"), mkEl("b", "", k), cp);
    c.appendChild(b);
    kitnew = false;
}

function kitOpen() {
    let m = $("kitm");
    if (!m) {
        m = mkEl("div", "vm");
        m.id = "kitm";
        m.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "Escape")
                kitClose();
        });
        m.addEventListener("pointerdown", e => {
            if (e.target === m)
                kitClose();
        });
        document.body.appendChild(m);
    }
    m.textContent = "";
    const c = mkEl("div", "vc");
    m.appendChild(c);
    const x = mkEl("button", "vx", "\u2715");
    x.onclick = kitClose;
    const hb = betaOn(), t = betaTxt();
    const h2 = mkEl("h2", "kit", "\uD83D\uDD0A Kitipo y Bajos");
    c.append(x, h2, mkEl("p", "vs", "M\u00e1s chucheros para tu radio con un pago \u00fanico"));
    const ul = mkEl("ul");
    const l1 = mkEl("li", "", "\uD83D\uDD0A Chucheros de 8, 10 y 12 pulgadas: cada uno distinto y de otro tama\u00f1o");
    const l2 = mkEl("li", "", "\uD83C\uDF9B\uFE0F Bajos de 12 a 2-21: m\u00e1s grande, m\u00e1s sub level y m\u00e1s blur");
    const l3 = mkEl("li", "", "\uD83E\uDDF1 Tablas de 8, 10 y 12 pulgadas: 3 tipos, hasta 4 de cada uno (las de 6 son gratis)");
    ul.append(l1, l2, l3);
    c.appendChild(ul);
    const pr = mkEl("div", "vprice");
    pr.append(document.createTextNode("$" + (window.RD_KIT_PRECIO || 5) + " "), mkEl("small", "", "USD \u00b7 pago \u00fanico"));
    c.appendChild(pr);
    if (kit)
        kitCodeBox(c);
    if (kitOK()) {
        kitSections(c);
    }
    else {
        const pay = mkEl("button", "vpay", "Pagar con PayPal"), or = mkEl("div", "vor", "\u00bfYa pagaste? Escribe tu c\u00f3digo de Kitipo y Bajos"), row = mkEl("div", "vcode"), inp = mkEl("input"), ok = mkEl("button", "", "Desbloquear"), msg = mkEl("div");
        msg.id = "kmsg";
        msg.className = "vmsg";
        inp.placeholder = "KB-XXXX-XXXX";
        inp.maxLength = 14;
        inp.autocomplete = "off";
        pay.onclick = () => {
            const u = window.RD_PAYPAL || "";
            if (!u || u.indexOf("TU_USUARIO") >= 0) {
                msg.textContent = "El pago a\u00fan no est\u00e1 configurado.";
                return;
            }
            window.open(u, "_blank", "noopener");
        };
        const go = () => {
            const k = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (kvalid(k))
                vsrv(k, "kit").then(er => er ? (msg.textContent = er) : kitGrant(vfmt(k), false));
            else
                msg.textContent = "C\u00f3digo incorrecto.";
        };
        ok.onclick = go;
        inp.addEventListener("keydown", e => {
            if (e.key === "Enter")
                go();
        });
        row.append(inp, ok);
        const ppb = mkEl("div"), use = vppLoad(ppb, msg, "Pioneer Radio Kitipo y Bajos", c => kitGrant(vfmt(c), true), "kit") ? ppb : pay;
        c.appendChild(mkEl("div", "vh", "GRATIS PARA TI"));
        kitSections(c);
        c.appendChild(mkEl("div", "vh", "DESBLOQUEA TODO"));
        c.append(vGate(use), mkEl("p", "vs", "Al pagar, tu c\u00f3digo aparece aqu\u00ed al instante y se desbloquea solo."), or, row, msg);
    }
    m.classList.add("show");
}

$("kitb") && $("kitb").addEventListener("click", kitOpen);

/* Restaurar chucheros y bajo guardados solo si siguen desbloqueados (al acabar la beta vuelve un chuchero de 6). */
try {
    let st = JSON.parse(localStorage.getItem("pioneerStack") || "null");
    if (!Array.isArray(st)) {
        const n = parseInt(localStorage.getItem("pioneerSpkSize"));
        st = n ? [n] : [6];
    }
    if (!kitOK() && st.some(n => n !== 6))
        st = st.filter(n => n === 6).slice(0, SPKMAX[6]).concat(st.length ? [] : [6]);
    if (!kitOK() && !st.length && localStorage.getItem("pioneerStack") !== "[]")
        st = [6];
    if (!(st.length === 1 && st[0] === 6))
        spkSet(st, false, true);
    const tb = JSON.parse(localStorage.getItem("pioneerTabs") || "null");
    if (Array.isArray(tb) && tb.length)
        tbSet(tb, false);
    rowSetOrd(JSON.parse(localStorage.getItem("pioneerRow") || "null"));
    const bj = localStorage.getItem("pioneerBajo");
    if (bj && (kitOK() || bj === "12"))
        setBajo(bj);
}
catch (e) { }

;
/**
 * Color de iluminación (ILLUMI)
 * Colores de las luces del radio.
 */

const COLORS = [{ n: "BLUE", hr: 0 }, { n: "CYAN", hr: -25 }, { n: "GREEN", hr: -80 }, { n: "AMBER", hr: 185 }, { n: "RED", hr: 155 }, { n: "PINK", hr: 115 }, { n: "PURPLE", hr: 75 }, { n: "RAINBOW" }];
let ci = 0;
const col = c => c.hr === undefined ? "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" : "hsl(" + (205 + c.hr) + ",100%,60%)";

COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.style.background = col(c);
    b.title = c.n;
    b.onclick = () => setColor(i, true);
    $("sw").appendChild(b);
});

function setColor(i, show) {
    ci = i;
    const c = COLORS[i], img = document.querySelector("#face img.bg"), mk = $("km"), ds = $("dsp");
    const rb = c.hr === undefined;
    ds.style.setProperty("--dh", rb ? 205 : (((205 + c.hr) % 360) + 360) % 360);
    img.classList.toggle("rb", rb);
    mk.classList.toggle("rb", rb);
    ds.classList.toggle("rb", rb);
    $("kln").classList.toggle("rb", rb);
    $("face").style.setProperty("--hr", rb ? "0deg" : c.hr + "deg");
    $("face").style.setProperty("--ih", rb ? "0deg" : (c.hr + ((MODELS[curModel] || {}).bh || 0)) + "deg");
    $("eqs").style.setProperty("--hr", rb ? "0deg" : c.hr + "deg");
    document.querySelectorAll("#eqs .kglow,#eqs .ledg").forEach(x => x.classList.toggle("rb", rb));
    [...$("sw").querySelectorAll("button")].forEach((b, j) => b.classList.toggle("on", j === i));
    try {
        localStorage.setItem("pioneerColor", i);
    }
    catch (e) { }
    if (show && on)
        ov("ILLUMI " + c.n);
}

function nextColor() {
    setColor((ci + 1) % COLORS.length, true);
}

try {
    const sv = parseInt(localStorage.getItem("pioneerColor"));
    setColor(isNaN(sv) ? 0 : sv, false);
}
catch (e) {
    setColor(0, false);
}

;
/**
 * Menú Opciones
 * Una sola ventana con los colores (ILLUMI, caja, chuchero), el tamaño del chuchero y los ecualizadores (+ / −).
 * No oscurece la página para que veas los cambios en vivo.
 */

function optClose() {
    $("optm").classList.remove("show");
}

(() => {
    const m = $("optm");
    const close = optClose;
    const open = () => {
        m.classList.add("show");
        $("optx").focus({ preventScroll: true });
    };
    $("optb") && $("optb").addEventListener("click", () => m.classList.contains("show") ? close() : open());
    $("optx") && $("optx").addEventListener("click", close);
    m.addEventListener("keydown", e => {
        e.stopPropagation();
        if (e.key === "Escape")
            close();
    });
    $("optrs") && $("optrs").addEventListener("click", () => {
        setColor(0, true);
        setCase("#ff2d2d", true);
        setSpk(SPKCOL[0][1], true);
        setDrv(null, true);
        setBlur(true, true);
        setPArrow(true, true);
    });
})();

/* Flecha para esconder / sacar los botones de al lado del radio. La flecha es opcional (se quita en Opciones). */
let pArrow = true, pOpen = true;
try {
    pArrow = localStorage.getItem("pioneerPArrow") !== "0";
    pOpen = localStorage.getItem("pioneerPOpen") !== "0";
}
catch (e) { }

function paintP() {
    const closed = pArrow && !pOpen;
    document.body.classList.toggle("pclosed", closed);
    document.body.classList.toggle("parrow", pArrow);
    const t = $("ptog");
    if (t) {
        t.setAttribute("aria-expanded", String(!closed));
        t.title = closed ? "Mostrar los botones" : "Esconder los botones";
    }
    const b = $("parb");
    if (b) {
        b.classList.toggle("on", pArrow);
        b.setAttribute("aria-pressed", String(pArrow));
        b.textContent = pArrow ? "\uD83D\uDFE2 Flecha: VISIBLE" : "\u26AA Flecha: QUITADA";
    }
}

function setPArrow(v, save) {
    pArrow = !!v;
    if (!pArrow) pOpen = true;   /* sin flecha los botones siempre quedan abiertos */
    if (save) {
        try { localStorage.setItem("pioneerPArrow", pArrow ? "1" : "0"); localStorage.setItem("pioneerPOpen", "1"); } catch (e) { }
    }
    paintP();
}

$("ptog") && $("ptog").addEventListener("click", () => {
    pOpen = !pOpen;
    try { localStorage.setItem("pioneerPOpen", pOpen ? "1" : "0"); } catch (e) { }
    paintP();
});
$("parb") && $("parb").addEventListener("click", () => setPArrow(!pArrow, true));
paintP();

;
/**
 * Cuenta: registro e inicio de sesión
 * Las cuentas viven en este navegador (localStorage). Al registrarse se busca el VIP guardado aquí y se liga a la cuenta.
 */

(() => {
    const UK = "pioneerUsers", SK = "pioneerSession", TK = "pioneerToken", E = mkEl, sl = ms => new Promise(r => setTimeout(r, ms));
    /* El VIP/Kitipo NO viaja dentro de los datos de la cuenta ni se copia entre cuentas: lo decide solo el servidor. */
    const VK = ["pioneerVIP", "pioneerVIPcode", "pioneerKIT", "pioneerKITcode", "pioneerCRO", "pioneerCROcode"];
    const own = k => k.indexOf("pioneer") === 0 && k !== UK && k !== SK && k !== TK && VK.indexOf(k) < 0;
    const clearVip = (v, k, c) => { try { if (c) { localStorage.removeItem("pioneerCRO"); localStorage.removeItem("pioneerCROcode"); } if (v) { localStorage.removeItem("pioneerVIP"); localStorage.removeItem("pioneerVIPcode"); } if (k) { localStorage.removeItem("pioneerKIT"); localStorage.removeItem("pioneerKITcode"); } } catch (e) { } };
    const flags = () => { try { return VK.map(k => localStorage.getItem(k) || "").join("|"); } catch (e) { return ""; } };
    const rd = () => { try { return JSON.parse(localStorage.getItem(UK)) || {}; } catch (e) { return {}; } };
    const wr = u => { try { localStorage.setItem(UK, JSON.stringify(u)); return true; } catch (e) { return false; } };
    const snap = () => { const o = {}; try { Object.keys(localStorage).filter(own).forEach(k => o[k] = localStorage.getItem(k)); } catch (e) { } return o; };
    const put = o => { try { Object.keys(localStorage).filter(own).forEach(k => localStorage.removeItem(k)); Object.keys(o || {}).filter(own).forEach(k => localStorage.setItem(k, o[k])); } catch (e) { } };
    const norm = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const hex = a => [...a].map(b => b.toString(16).padStart(2, "0")).join("");
    const REM = () => !!(window.RD_DB_URL && window.RD_DB_KEY), tok = () => { try { return localStorage.getItem(TK) || ""; } catch (e) { return ""; } };
    let leaving = false;
    let chk = false;   /* el servidor ya dio una respuesta definitiva sobre la sesi\u00f3n */
    let ok = false;   /* acceso verificado: solo es true con una sesi\u00f3n confirmada por el servidor (o una cuenta local si no hay servidor) */
    async function rpc(fn, args) {
        const b = JSON.stringify(args), k = window.RD_DB_KEY, h = { "Content-Type": "application/json", apikey: k };
        if (k.indexOf("eyJ") === 0) h.Authorization = "Bearer " + k;
        let r;
        try {
            r = await fetch(String(window.RD_DB_URL).replace(/\/$/, "") + "/rest/v1/rpc/" + fn, { method: "POST", headers: h, body: b, keepalive: leaving && b.length < 60000 });
        } catch (e0) {
            const x = new Error("red"); x.net = true; throw x;
        }
        const j = await r.json().catch(() => null);
        if (!r.ok) { const x = new Error((j && j.message) || "red"); x.http = r.status; throw x; }
        return j;
    }
    const dbErr = e => {
        const m = String(e && e.message || ""), k = { usuario_existe: "Ese usuario ya existe. Elige otro o inicia sesi\u00f3n.", credenciales: "Usuario o contrase\u00f1a incorrectos.", codigo_en_uso: "Ese c\u00f3digo ya est\u00e1 ligado a otra cuenta.", codigo_invalido: "C\u00f3digo incorrecto.", datos_invalidos: "Revisa el usuario y la contrase\u00f1a.", sesion: "Tu sesi\u00f3n no est\u00e1 conectada a la base de datos. Cierra sesi\u00f3n y entra de nuevo con internet.", no_admin: "Solo el administrador puede hacer esto.", admin_cerrado: "El permiso de administrador venci\u00f3 (dura 20 minutos). Vuelve a abrir el panel con tu PIN.", admin_sin_pin: "Primero crea tu PIN de administrador.", pin_debil: "El PIN debe tener de 8 a 40 caracteres con letras y n\u00fameros.", pin_existe: "Ya tienes un PIN creado.", pin_bloqueado: "Demasiados intentos. Espera 15 minutos.", pin_incorrecto: "PIN incorrecto.", solo_ricky: "Solo la cuenta ricky puede a\u00f1adir o quitar administradores.", no_quitar_dueno: "No se puede quitar al propietario.", usuario_no_existe: "Ese usuario no existe.", limite: "Llegaste al l\u00edmite de proyectos.", imagen_invalida: "Imagen no v\u00e1lida o muy pesada.", sin_fondos: "No tienes monedas suficientes.", no_existe: "No existe o ya no est\u00e1 disponible." }[m];
        if (k) return k;
        if (e && e.net) return "No se pudo conectar con el servidor. Revisa tu internet e int\u00e9ntalo de nuevo.";
        return "No se pudo completar la acci\u00f3n. Int\u00e9ntalo de nuevo en un momento.";   /* nunca se muestran los errores internos de la base de datos */
    };
    const push = a => REM() && tok() ? rpc("guardar", { p_token: tok(), p_datos: a.d }).catch(() => { }) : Promise.resolve();
    const tried = {};
    /* El VIP lo valida el servidor: se canjea el código guardado en este navegador (un código = una cuenta). */
    async function redeem(a) {
        if (!REM() || !tok()) return;
        const g = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
        for (const [f, on, ck] of [["v", "pioneerVIP", "pioneerVIPcode"], ["k", "pioneerKIT", "pioneerKITcode"], ["c", "pioneerCRO", "pioneerCROcode"]]) {
            const code = g(ck);
            if (a[f] || g(on) !== "1" || !code || code === "ADMIN" || tried[code]) continue;
            tried[code] = 1;
            try { const r = await rpc("canjear", { p_token: tok(), p_codigo: code }); if (r && typeof r === "object" && !r.error && r.tipo === (f === "v" ? "vip" : f === "k" ? "kit" : "cro")) a[f] = true; } catch (e) { }
        }
    }
    /* Si la cuenta tiene VIP en la base de datos, se restaura aunque el navegador lo haya perdido. */
    function ensure(a) {
        try {
            [["v", "pioneerVIP", "vc", "pioneerVIPcode"], ["k", "pioneerKIT", "kc", "pioneerKITcode"], ["c", "pioneerCRO", "cc", "pioneerCROcode"]].forEach(([f, k, c, ck]) => {
                if (!a[f]) return;
                localStorage.setItem(k, "1");
                if (a[c] && !localStorage.getItem(ck)) localStorage.setItem(ck, a[c].length === 10 ? vfmt(a[c]) : a[c]);
            });
        } catch (e) { }
    }
    /* Cuenta antigua guardada solo en este navegador: se pasa a la base de datos con la misma contraseña, el VIP y los ajustes. */
    let cur = null, m = null;

    /* ¿Hay VIP / Kitipo válidos guardados en este navegador? */
    function detect() {
        const g = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
        const vc = g("pioneerVIPcode"), kc = g("pioneerKITcode");
        return { vip: g("pioneerVIP") === "1" && vvalid(norm(vc)), kit: g("pioneerKIT") === "1" && kvalid(norm(kc)), cro: g("pioneerCRO") === "1" && cvalid(norm(g("pioneerCROcode"))) };
    }

    /* Solo PBKDF2 (el navegador). Sin ese m\u00e9todo no se guarda nada: ya no hay hash propio. Solo se usa en el modo local (sin servidor). */
    async function hash(p, salt, mode) {
        if (mode === "f" || !(window.crypto && crypto.subtle)) return "";
        try {
            const e = new TextEncoder(), km = await crypto.subtle.importKey("raw", e.encode(p), "PBKDF2", false, ["deriveBits"]);
            return "p:" + hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: e.encode(salt), iterations: 100000, hash: "SHA-256" }, km, 256)));
        } catch (e) { return ""; }
    }

    /* Ventana */
    const close = () => { if (cur && m) m.classList.remove("show"); };
    function card(cls) {
        if (!m || !m.isConnected) {
            m = E("div", "vm acm");
            m.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") close(); });
            m.addEventListener("pointerdown", e => { if (e.target === m) close(); });
            document.body.appendChild(m);
        }
        m.textContent = "";
        m.removeAttribute("style"); m.hidden = false;   /* si alguien lo ocult\u00f3 desde fuera, se vuelve a mostrar */
        const c = E("div", "vc ac " + (cls || "")), x = E("button", "vx", "\u2715");
        x.type = "button";
        x.onclick = close;
        if (!cur) x.style.display = "none";
        c.append(E("div", "acg"), x);
        m.appendChild(c);
        m.classList.add("show");
        return c;
    }

    function field(lab, type, ac, ic) {
        const w = E("label", "acf"), i = E("input");
        i.type = type; i.placeholder = " "; i.autocomplete = ac; i.maxLength = 40; i.spellcheck = false;
        w.append(i, E("span", "", lab), E("i", "", ic));
        if (type === "password") {
            const e = E("button", "ace", "\uD83D\uDC41");
            e.type = "button"; e.tabIndex = -1;
            e.onclick = () => { i.type = i.type === "password" ? "text" : "password"; };
            w.appendChild(e);
        }
        return { w, i };
    }

    function authView(tab) {
        const c = card("auth"), h = E("h2"), s = E("p", "vs"), tabs = E("div", "act"), body = E("div");
        const draw = t => {
            const reg = t === 1;
            tabs.classList.toggle("r", reg);
            [...tabs.children].forEach((b, i) => b.classList && b.classList.toggle("on", i === t));
            h.textContent = reg ? "Crea tu cuenta" : "Bienvenido de vuelta";
            s.textContent = reg ? "Guarda tu VIP y tus configuraciones en tu cuenta." : "Entra para cargar tu VIP y tus ajustes.";
            body.textContent = "";
            const f = E("form", "acb"), u = field("Usuario", "text", "username", "\uD83D\uDC64"), p = field("Contrase\u00f1a", "password", reg ? "new-password" : "current-password", "\uD83D\uDD12"), q = field("Repite la contrase\u00f1a", "password", "new-password", "\uD83D\uDD12");
            const err = E("div", "acerr"), sub = E("button", "acsub", reg ? "Crear cuenta" : "Entrar");
            f.noValidate = true; sub.type = "submit";
            f.append(u.w, p.w);
            if (reg) {
                const sm = E("div", "acs");
                sm.append(E("b"), E("b"), E("b"), E("b"), E("span"));
                p.i.oninput = () => {
                    const v = p.i.value, n = Math.min(4, (v.length >= 6) + (v.length >= 9) + (/[a-z]/.test(v) && /[A-Z]/.test(v)) + (/\d/.test(v) && /\W/.test(v)));
                    sm.dataset.s = v ? n : 0;
                    sm.lastChild.textContent = v ? ["Muy corta", "D\u00e9bil", "Media", "Fuerte", "Excelente"][n] : "";
                };
                f.append(sm, q.w);
            }
            f.append(err, sub);
            f.onsubmit = async e => {
                e.preventDefault();
                err.textContent = "";
                const bad = t => { err.textContent = t; c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); sub.classList.remove("ld"); };
                const n = u.i.value.trim(), pw = p.i.value;
                if (!/^[A-Za-z0-9_.-]{3,20}$/.test(n)) return bad("Usuario de 3 a 20 caracteres: letras, n\u00fameros, _ . o -");
                if (pw.length < 8) return bad("La contrase\u00f1a debe tener al menos 8 caracteres.");
                if (reg && pw !== q.i.value) return bad("Las contrase\u00f1as no coinciden.");
                sub.classList.add("ld");
                const users = rd(), key = n.toLowerCase();
                await sl(400);
                if (reg) {
                    if (!REM() && users[key]) return bad("Ese usuario ya existe. Elige otro o inicia sesi\u00f3n.");
                    const d = detect(), s0 = snap();
                    if (REM()) {
                        /* con servidor: la cuenta se crea all\u00ed; aqu\u00ed NO se guarda ninguna copia de la contrase\u00f1a */
                        try {
                            const r = await rpc("registrar", { p_usuario: key, p_nombre: n, p_clave: pw, p_datos: s0 });
                            if (!r || !r.token) return bad("No se pudo crear la cuenta. Int\u00e9ntalo de nuevo.");
                            localStorage.setItem(TK, r.token);
                        } catch (e3) {
                            return bad(dbErr(e3));
                        }
                        users[key] = { n, t: Date.now(), v: false, k: false, d: s0 };
                        await redeem(users[key]);
                        clearVipIfNot(users[key]);   /* si el servidor no le da el pase, no se queda el del navegador */
                    } else {
                        const salt = hex(crypto.getRandomValues(new Uint8Array(12))), hh = await hash(pw, salt);
                        if (!hh) return bad("Este navegador no permite crear cuentas locales seguras.");
                        users[key] = { n, s: salt, h: hh, t: Date.now(), v: d.vip, k: d.kit, d: s0 };
                    }
                    if (!wr(users)) return bad("No se pudo guardar la cuenta en este navegador.");
                    try { localStorage.setItem(SK, key); } catch (e2) { }
                    cur = key; paint();
                    return scan(n, users[key].v ? "vip" : "new", users[key].k);
                }
                let a = users[key];
                if (REM()) {
                    try {
                        const r = await rpc("entrar", { p_usuario: key, p_clave: pw });
                        if (!r || (!r.error && !r.token)) return bad("No se pudo entrar. Int\u00e9ntalo de nuevo.");
                        if (r.error) return bad(r.error === "bloqueado" ? "Demasiados intentos. Espera " + Math.ceil(r.seg / 60) + " min." : "Usuario o contrase\u00f1a incorrectos.");
                        localStorage.setItem(TK, r.token);
                        a = { n: r.nombre, t: Date.parse(r.creada) || Date.now(), v: !!r.vip, k: !!r.kit, c: !!r.cro, vc: r.vc, kc: r.kc, cc: r.cc, d: r.datos || {} };   /* sin copia de la contrase\u00f1a */
                    } catch (e3) {
                        return bad(dbErr(e3));
                    }
                }
                else {
                    const hh = a && a.h ? await hash(pw, a.s, a.h[0]) : "";
                    if (!hh || hh !== a.h) return bad("Usuario o contrase\u00f1a incorrectos.");
                }
                await enter(users, key, a);
            };
            body.appendChild(f);
            setTimeout(() => u.i.focus({ preventScroll: true }), 60);
        };
        [["Entrar"], ["Registrarme"]].forEach((n, i) => { const b = E("button", "", n[0]); b.type = "button"; b.onclick = () => draw(i); tabs.appendChild(b); });
        tabs.appendChild(E("i"));
        c.append(E("div", "ach", "\uD83D\uDCFB"), h, s, tabs, body);
        draw(tab);
    }

    /* Quita los pases del navegador Y de la memoria de la p\u00e1gina (sin recargar) cuando la cuenta no los tiene en el servidor. */
    const clearVipIfNot = a => {
        clearVip(!a.v, !a.k, !a.c);
        try {
            if (!a.v && typeof vip !== "undefined" && vip) { vip = false; applyCfg(); }
            if (!a.c && typeof cro !== "undefined" && cro && typeof croSync === "function") croSync(false);
            if (!a.k && typeof kit !== "undefined" && kit) {
                kit = false;
                spkSet(spkStack.filter(n => n === 6).slice(0, SPKMAX[6]), false, true);
                tbSet(tbStack, false);
                if (bajoId && bajoId !== "12") setBajo("", false);
            }
        } catch (e) { }
    };

    /* Inicio de sesión: carga lo guardado en la cuenta (o liga el VIP que ya hay en el navegador) */
    async function enter(users, key, a) {
        const d = detect(), before = JSON.stringify(snap()) + flags();
        let kind = "plain";
        const had = a.v;
        if (!had) await redeem(a);
        if (a.v) { if (had) put(a.d); else a.d = snap(); ensure(a); kind = had ? "back" : "vip"; }
        else if (d.vip && !REM()) { a.d = snap(); a.v = true; a.k = d.kit; a.c = d.cro; kind = "vip"; }
        else put(a.d);   /* sin VIP en el servidor: se descartan los permisos que hubiera en el navegador */
        if (REM()) clearVipIfNot(a);
        if (a.c && typeof croSync === "function") croSync(true, a.cc);
        users[key] = a; wr(users);
        if (kind === "vip") await push(a);
        try { localStorage.setItem(SK, key); } catch (e) { }
        cur = key; ok = true;
        if (JSON.stringify(snap()) + flags() !== before) {
            try { sessionStorage.setItem("pioneerWelcome", JSON.stringify({ n: a.n, kind, kit: a.k })); } catch (e) { }
            location.reload();
        } else { paint(); welcome(a.n, kind, a.k); }
    }

    /* Verificación animada al registrarse */
    async function scan(n, kind, kit) {
        const c = card("scan"), l = E("div");
        c.append(E("div", "ach", "\uD83D\uDD0E"), E("h2", "", "Verificando tu navegador..."), l);
        for (const t of ["Cuenta creada", kind === "vip" ? "\u00a1VIP encontrado en este navegador!" : "Buscando VIP en este navegador", "Guardando tus configuraciones"]) {
            const r = E("div", "acsr");
            r.append(E("i"), E("span", "", t));
            l.appendChild(r);
            await sl(650);
            r.classList.add("ok");
        }
        await sl(350);
        welcome(n, kind, kit);
    }

    function welcome(n, kind, kit) {
        const v = kind === "vip" || kind === "back", c = card(v ? "gold" : "");
        const T = { vip: ["\u00a1Bienvenido, ", "Como detectamos que hab\u00edas comprado VIP, hemos cargado tu VIP y tus configuraciones."], back: ["\u00a1Qu\u00e9 bueno verte, ", "Hemos cargado tu VIP y tus configuraciones."], new: ["\u00a1Cuenta creada, ", "No detectamos un VIP en este navegador. Si ya pagaste, escribe tu c\u00f3digo en Personalizaci\u00f3n y quedar\u00e1 guardado en tu cuenta."], plain: ["\u00a1Hola de nuevo, ", "Hemos cargado tus configuraciones."] }[kind];
        c.append(E("div", "ackc", v ? "\u2B50" : "\u2713"), E("h2", "", T[0] + n + "!"), E("div", "acmsg", T[1]));
        if (v) {
            const ch = E("div", "acch");
            ch.append(E("span", "", "\u2B50 Personalizaci\u00f3n VIP"), E("span", "", kit ? "\uD83D\uDD0A Kitipo y Bajos" : "\uD83D\uDCFB Radio y caja"), E("span", "", "\uD83C\uDFA8 Configuraciones"));
            c.appendChild(ch);
        }
        const go = E("button", "acsub", "Continuar");
        go.type = "button"; go.onclick = close;
        c.appendChild(go);
    }

    function panel() {
        const a = rd()[cur];
        if (!a) { cur = null; paint(); return authView(0); }
        const c = card(a.v ? "gold" : ""), st = E("div", "acst"), out = E("button", "acout", "Cerrar sesi\u00f3n");
        st.append(E("div", a.v ? "on" : "", a.v ? "\u2B50 VIP activo" : "\u2B50 Sin VIP"), E("div", a.k ? "on" : "", a.k ? "\uD83D\uDD0A Kitipo y Bajos activo" : "\uD83D\uDD0A Sin Kitipo y Bajos"), E("div", a.c ? "on" : "", a.c ? "\uD83C\uDF9B\uFE0F Crossover y Procesador activo" : "\uD83C\uDF9B\uFE0F Sin Crossover y Procesador"));
        out.type = "button";
        out.onclick = async () => {
            out.disabled = true;
            await sync();
            if (REM() && tok()) await rpc("salir", { p_token: tok() }).catch(() => { });
            cur = null;
            try { localStorage.removeItem(SK); localStorage.removeItem(TK); } catch (e) { }
            /* Al salir se limpia el navegador (ajustes y pases) para que la siguiente cuenta no herede nada. */
            put({}); clearVip(true, true);
            location.reload();
        };
        c.append(E("div", "acav", a.n[0].toUpperCase()), E("h2", "", a.n), E("p", "vs", "Miembro desde " + new Date(a.t).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })), st, E("p", "vs", REM() ? "Tu VIP y tus ajustes se guardan solos en tu cuenta en l\u00ednea." : "Tu VIP y tus ajustes se guardan solos en este navegador."));
        if (window.rdEquipos) { window.rdEquipos.decorar(c); c.appendChild(window.rdEquipos.boton()); }
        c.appendChild(out);
    }

    /* Guarda en la cuenta lo que cambie (VIP, colores, ecualizadores...) */
    async function sync() {
        if (!cur) return;
        const u = rd(), a = u[cur];
        if (!a) return;
        const s = snap();
        let dirty = JSON.stringify(s) !== JSON.stringify(a.d);
        if (REM()) { const v0 = a.v, k0 = a.k, c0 = a.c; await redeem(a); if (a.v !== v0 || a.k !== k0 || a.c !== c0) dirty = true; }
        else { const d = detect(); if ((d.vip && !a.v) || (d.kit && !a.k) || (d.cro && !a.c)) { a.v = a.v || d.vip; a.k = a.k || d.kit; a.c = a.c || d.cro; dirty = true; } }
        if (!dirty) return;
        a.d = s;
        wr(u); paint();
        await push(a);
    }

    /* La pantalla de carga (10 s) tapa todo: se espera a que termine */
    const ready = fn => { const t = setInterval(() => { if (!document.getElementById("ld")) { clearInterval(t); fn(); } }, 200); };

    const pill = E("button", "accb");
    pill.type = "button";
    pill.onclick = () => cur ? panel() : authView(0);
    document.body.appendChild(pill);

    function paint() {
        const a = cur && rd()[cur];
        pill.textContent = "";
        pill.classList.toggle("in", !!a);
        pill.classList.toggle("gd", !!(a && a.v));
        pill.append(E("b", "", a ? a.n[0].toUpperCase() : "\uD83D\uDC64"), E("span", "", a ? a.n : "Iniciar sesi\u00f3n"));
        if (a && window.rdEquipos) window.rdEquipos.pill(pill);
    }

    /* Con servidor ya no se guarda ninguna copia de contrase\u00f1as en este navegador: se borran las que hubiera. */
    if (REM()) { const u0 = rd(); let ch = false; Object.keys(u0).forEach(k => { if (u0[k] && (u0[k].h || u0[k].s)) { delete u0[k].h; delete u0[k].s; ch = true; } }); if (ch) wr(u0); }
    try { cur = localStorage.getItem(SK); } catch (e) { }
    if (cur && !rd()[cur]) cur = null;
    paint();
    /* El servidor manda: se pregunta al cargar, cada 30 s y al volver a la pesta\u00f1a. Si dice que no hay pase, se quita YA (navegador, variables y pantalla). */
    let pf = false;
    function refresh() {
        if (!REM() || !cur || !tok() || pf) return Promise.resolve();
        pf = true;
        return rpc("perfil", { p_token: tok() }).then(r => {
            const u = rd(), a = u[cur];
            if (!a) return;
            if (!r || typeof r !== "object" || r.error) return;
            ok = true; chk = true;
            /* respuesta vac\u00eda o rara: no se concede nada, solo se deja como est\u00e1 */
            const antes = JSON.stringify(snap()), v0 = a.v, k0 = a.k, c0 = a.c;
            a.v = r.vip === true; a.k = r.kit === true; a.c = r.cro === true; a.vc = r.vc; a.kc = r.kc; a.cc = r.cc;
            clearVipIfNot(a);
            wr(u);
            ensure(a); paint();
            if (typeof croSync === "function") croSync(a.c, a.cc);
            if (a.v !== v0 || a.k !== k0) { try { const vm = document.getElementById("vipm"), km = document.getElementById("kitm"); if (vm && vm.classList.contains("show")) vipOpen(); if (km && km.classList.contains("show")) kitOpen(); } catch (e) { } }
            /* Recarga solo si cambi\u00f3 algo importante, y como mucho UNA vez por minuto: as\u00ed nunca puede quedar recargando sin parar. */
            if (JSON.stringify(snap()) !== antes && (a.v || a.k)) {
                let ult = 0;
                try { ult = +sessionStorage.getItem("rdUltRecarga") || 0; } catch (e) { }
                if (Date.now() - ult > 60000) { try { sessionStorage.setItem("rdUltRecarga", String(Date.now())); } catch (e) { } location.reload(); }
            }
        }).catch(e => {
            if (e.message === "sesion") { ok = false; chk = true; cur = null; try { localStorage.removeItem(SK); localStorage.removeItem(TK); } catch (x) { } clearVipIfNot({ v: false, k: false, c: false }); paint(); }
        }).then(() => { pf = false; if (!chk && !ok) setTimeout(refresh, 4000); });   /* sin respuesta (red lenta o ca\u00edda): se reintenta */
    }
    /* Sin sesi\u00f3n v\u00e1lida en una p\u00e1gina con servidor, un pase escrito a mano en el navegador no vale. */
    if (REM() && (!cur || !tok())) clearVipIfNot({ v: false, k: false, c: false });
    refresh();
    setInterval(refresh, 120000);   /* cada 2 min (antes 30 s): menos lecturas de disco; al volver a la pesta\u00f1a se actualiza al instante */
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    setInterval(sync, 4000);
    addEventListener("pagehide", () => { leaving = true; sync(); });
    document.addEventListener("visibilitychange", () => document.hidden && sync());
    try {
        const w = sessionStorage.getItem("pioneerWelcome");
        if (w) {
            sessionStorage.removeItem("pioneerWelcome");
            const o = JSON.parse(w);
            ready(() => welcome(o.n, o.kind, o.kit));
        }
    } catch (e) { }
    if (!cur) ready(() => authView(0));
    /* ---- Puerta de acceso: sin sesi\u00f3n verificada no suena nada y la ventana de entrar no se puede quitar ----
       Quitar la ventana desde el navegador (DOM, marcador) ya no sirve: la m\u00fasica se bloquea aqu\u00ed dentro y la ventana vuelve a aparecer. */
    if (!REM()) ok = !!cur;
    rdAcceso = () => ok;
    const play0 = A.play.bind(A);
    A.play = function () { return ok ? play0() : Promise.reject(new DOMException("Inicia sesi\u00f3n", "NotAllowedError")); };
    setInterval(() => {
        if (ok) return;
        try { if (!A.paused) A.pause(); } catch (e) { }
        if (document.getElementById("ld")) return;       /* todav\u00eda cargando */
        if (REM() && cur && tok() && !chk) return;       /* hay sesi\u00f3n guardada y el servidor a\u00fan no responde: se espera, no se muestra el login */
        const vis = m && m.isConnected && m.classList.contains("show") && getComputedStyle(m).display !== "none" && getComputedStyle(m).visibility !== "hidden";
        if (!vis) { try { authView(0); } catch (e) { } }
    }, 800);
    /* congelado: no se pueden reemplazar rpc/REM/tok desde fuera */
    window.rdApi = Object.freeze({ rpc, tok, REM, card, field, err: dbErr, user: () => cur, login: () => authView(0), refresh, paint });
})();

;
/**
 * Detección automática de bocinas
 * Busca círculos (conos de bocinas) en una imagen con una transformada de Hough y devuelve
 * [{x, y, r, k}] en proporciones (x e y respecto al ancho/alto, r respecto al ANCHO), con k = "b" | "m" | "t"
 * según el tamaño relativo (grandes = graves, medianas = medios, chicas = agudos).
 * No usa el DOM: recibe los píxeles RGBA (Uint8ClampedArray) y su tamaño.
 */

function detectarBocinas(rgba, W, H, maxN) {
    maxN = maxN || 8;
    /* 1. Reducir a ~60 000 píxeles para que sea rápido (promedio por cajas) */
    const sc = Math.min(1, Math.sqrt(60000 / (W * H))), w = Math.max(24, Math.round(W * sc)), h = Math.max(24, Math.round(H * sc));
    const L = new Float32Array(w * h), A = new Float32Array(w * h), N = new Float32Array(w * h);
    for (let y = 0; y < H; y++) {
        const dy = Math.min(h - 1, (y * h / H) | 0);
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4, a = rgba[i + 3] / 255, d = dy * w + Math.min(w - 1, (x * w / W) | 0);
            L[d] += (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a;
            A[d] += rgba[i + 3];
            N[d]++;
        }
    }
    for (let i = 0; i < w * h; i++) {
        if (N[i]) {
            L[i] /= N[i];
            A[i] /= N[i];
        }
    }
    /* 2. Bordes (Sobel) sobre luminosidad y transparencia */
    const gx = new Float32Array(w * h), gy = new Float32Array(w * h), mg = new Float32Array(w * h);
    const hist = new Uint32Array(1500);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            const sx = (F) => (F[i - w + 1] + 2 * F[i + 1] + F[i + w + 1]) - (F[i - w - 1] + 2 * F[i - 1] + F[i + w - 1]);
            const sy = (F) => (F[i + w - 1] + 2 * F[i + w] + F[i + w + 1]) - (F[i - w - 1] + 2 * F[i - w] + F[i - w + 1]);
            const lx = sx(L), ly = sy(L), ax = sx(A), ay = sy(A), ml = Math.hypot(lx, ly), ma = Math.hypot(ax, ay);
            if (ma > ml) {
                gx[i] = ax;
                gy[i] = ay;
                mg[i] = ma;
            }
            else {
                gx[i] = lx;
                gy[i] = ly;
                mg[i] = ml;
            }
            hist[Math.min(1499, mg[i] | 0)]++;
        }
    }
    let thr = 0, acc0 = 0;
    for (let v = 1499; v >= 0; v--) {
        acc0 += hist[v];
        if (acc0 > w * h * 0.2) {
            thr = v;
            break;
        }
    }
    thr = Math.max(16, thr);
    /* 3. Votación de Hough: cada borde vota por centros a distancia r en la dirección del gradiente */
    const r0 = Math.max(4, Math.round(w * 0.05)), r1 = Math.min(Math.round(w * 0.56), Math.round(h * 0.56)), nr = r1 - r0 + 1;
    if (nr < 2)
        return [];
    const acc = new Uint16Array(nr * w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (mg[i] < thr)
                continue;
            const ux = gx[i] / mg[i], uy = gy[i] / mg[i];
            for (let k = 0; k < nr; k++) {
                const r = r0 + k, o = k * w * h;
                let cx = Math.round(x + ux * r), cy = Math.round(y + uy * r);
                if (cx >= 0 && cx < w && cy >= 0 && cy < h)
                    acc[o + cy * w + cx]++;
                cx = Math.round(x - ux * r);
                cy = Math.round(y - uy * r);
                if (cx >= 0 && cx < w && cy >= 0 && cy < h)
                    acc[o + cy * w + cx]++;
            }
        }
    }
    /* 4. Candidatos: máximos locales (suma 3×3) con suficiente parte de la circunferencia */
    const cand = [];
    const s3 = (o, x, y) => {
        let s = 0;
        for (let j = -1; j <= 1; j++)
            for (let i = -1; i <= 1; i++)
                s += acc[o + (y + j) * w + x + i];
        return s;
    };
    for (let k = 0; k < nr; k++) {
        const r = r0 + k, o = k * w * h, need = Math.max(10, 0.45 * Math.PI * r);
        for (let y = 2; y < h - 2; y++) {
            for (let x = 2; x < w - 2; x++) {
                if (acc[o + y * w + x] < 3)
                    continue;
                const s = s3(o, x, y);
                if (s < need)
                    continue;
                let ok = true;
                for (let j = -2; j <= 2 && ok; j++)
                    for (let i = -2; i <= 2 && ok; i++)
                        if ((i || j) && s3(o, x + i, y + j) > s)
                            ok = false;
                if (ok && k > 0 && s3(o - w * h, x, y) > s)
                    ok = false;
                if (ok && k < nr - 1 && s3(o + w * h, x, y) > s)
                    ok = false;
                if (ok)
                    cand.push({ x, y, r, s, sc: s / (2 * Math.PI * r) });
            }
        }
    }
    if (!cand.length)
        return [];
    /* 5. Quitar duplicados y escoger el círculo exterior de cada bocina */
    cand.sort((a, b) => b.sc - a.sc);
    const uniq = [];
    for (const c of cand)
        if (!uniq.some(u => Math.hypot(u.x - c.x, u.y - c.y) < 0.3 * Math.max(u.r, c.r) && Math.abs(u.r - c.r) < 0.25 * Math.max(u.r, c.r)))
            uniq.push(c);
    /* Cada bocina tiene varios aros concéntricos (tapa, cono, canasta): se agrupan por centro y se toma el más grande.
       El grupo debe tener al menos un aro bien marcado (>= 0.45) para no confundir ruido con una bocina. */
    const pool = uniq.filter(c => c.sc >= 0.2).sort((a, b) => b.sc - a.sc), groups = [];
    for (const c of pool) {
        const g = groups.find(q => Math.hypot(q.c.x - c.x, q.c.y - c.y) < 0.25 * Math.max(q.c.r, c.r));
        if (g)
            g.m.push(c);
        else
            groups.push({ c, m: [c] });
    }
    let out = groups.filter(g => g.c.sc >= 0.45).map(g => {
        const o = g.m.slice().sort((a, b) => b.r - a.r)[0];
        return { x: g.c.x, y: g.c.y, r: o.r, sc: g.c.sc };
    });
    /* Los círculos muy chicos frente a la bocina principal son tornillos o adornos */
    const maxR = Math.max(...out.map(c => c.r));
    out = out.filter(c => c.r >= maxR * 0.28);
    /* Si dos bocinas se pisan mucho, se queda la de mejor puntuación */
    out.sort((a, b) => b.sc - a.sc);
    const fin = [];
    for (const c of out)
        if (!fin.some(f => Math.hypot(f.x - c.x, f.y - c.y) < (f.r + c.r) * 0.85))
            fin.push(c);
    const sel = fin.slice(0, maxN).sort((a, b) => b.r - a.r);
    if (!sel.length)
        return [];
    /* Tipo según el tamaño: se agrupan los radios parecidos; el grupo más grande son graves (b),
       el más chico agudos (t) y los de en medio medios (m). Si todas son iguales, todas son graves. */
    const cl = [[sel[0]]];
    for (let i = 1; i < sel.length; i++) {
        const g = cl[cl.length - 1];
        if (g[g.length - 1].r / sel[i].r > 1.2)
            cl.push([sel[i]]);
        else
            g.push(sel[i]);
    }
    cl.forEach((g, gi) => g.forEach(c => {
        c.k = gi === 0 ? "b" : gi === cl.length - 1 ? "t" : "m";
    }));
    return sel.map(c => {
        const r = Math.min(c.r * (c.k === "b" ? 1.15 : 1), w / 2);
        return { x: +(c.x / w).toFixed(4), y: +(c.y / h).toFixed(4), r: +(r / w).toFixed(4), k: c.k };
    });
}

;
/**
 * Proyectos: inventario (privados y personalizados), proyecto movible y fijable, y panel de administrador (solo "ricky").
 * Todo se guarda en la base de datos; la posición viaja dentro de los datos de la cuenta.
 */

/*
 * GLOSARIO (nombres cortos de este archivo)
 *   LOCALES  proyectos privados que se ponen por usuario (quien: ["usuario"]); los conos van en proporciones 0..1.
 *   conos    bocinas animadas: { x, y, r, k } con k = "b" bajo, "m" medio, "t" tweeter.
 *   R(fn,p)  llama a una funcion SQL de Supabase (rpc).
 *   TABS     pestanas del panel de administrador / ayudantes.
 *   pAyu     panel de ayudantes (roles admin y ayudante).
 */

(() => {
    const api = window.rdApi;
    if (!api) return;
    const DB = api.REM(), E = mkEl, K = "pioneerPrj", st = { id: "", x: .5, y: .72, fijo: true, w: .2 };
    let inv = [], last, el = null;
    try { Object.assign(st, JSON.parse(localStorage.getItem(K) || "{}")); } catch (e) { }
    const sv = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch (e) { } };
    const R = (fn, a) => api.rpc(fn, Object.assign({ p_token: api.tok() }, a || {})).catch(e => {
        /* si el permiso de admin venci\u00f3, la pr\u00f3xima vez se pide el PIN otra vez */
        if (e && (e.message === "admin_cerrado" || e.message === "admin_sin_pin")) { adm = { ok: false, dueno: false, yo: "", lista: [] }; est.abierto = false; }
        throw e;
    });
    const msg = e => api.err(e);
    /* Las im\u00e1genes de los proyectos NO vienen en la lista (pesan mucho y gastan disco): se piden una vez, solo cuando se necesitan, y se guardan en este navegador. */
    const IMG = {};
    const lsGet = id => { try { return localStorage.getItem("rdimg:" + id) || ""; } catch (e) { return ""; } };
    const lsSet = (id, v) => { try { localStorage.setItem("rdimg:" + id, v); } catch (e) { } };
    async function imgOf(p) {
        if (p.imagen) return p.imagen;
        if (p.tipo !== "imagen") return "";
        let v = IMG[p.id] || lsGet(p.id);
        if (!v) {
            try { const r = await R("proyecto_imagen", { p_id: p.id }); v = r && typeof r.imagen === "string" ? r.imagen : ""; } catch (e) { v = ""; }
            if (v) lsSet(p.id, v);
        }
        if (v) IMG[p.id] = p.imagen = v;
        return v;
    }

    /* Un solo panel a la vez: lo que termina tarde no reabre ni pisa otro panel ni uno que ya cerraste. */
    let gen = 0;
    const card = cls => { gen++; return api.card(cls); };
    const alive = my => my === gen && !!document.querySelector(".acm.show");
    const g = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };

    function show() {
        if (el) { el.remove(); el = null; }
        const p = inv.find(x => x.id === st.id);
        $("spk").style.display = p && p.tipo === "imagen" ? "none" : "";
        if (!p || p.tipo !== "imagen") return;
        el = E("div");
        el.id = "prj";
        const cv = E("canvas"), im = new Image(), bd = E("b");
        im.onload = () => { cv.width = im.naturalWidth; cv.height = im.naturalHeight; anim(cv, im, p.conos || []); };
        if (p.imagen) im.src = p.imagen;
        else imgOf(p).then(v => { if (v && cv.isConnected) im.src = v; });
        const rz = E("i", "rsz", "\u21F2");
        el.append(cv, bd, rz);
        const ps = () => {
            el.style.left = st.x * 100 + "vw"; el.style.top = st.y * 100 + "vh";
            el.style.width = st.w * 100 + "vw";
            el.classList.toggle("free", !st.fijo);
            bd.textContent = st.fijo ? "\uD83D\uDCCC" : "\uD83D\uDD13";
            el.title = st.fijo ? "Click para desfijar y poder moverlo o agrandarlo" : "Arr\u00e1stralo, usa la esquina o la rueda para cambiar el tama\u00f1o, o haz click para fijarlo";
        };
        const big = w => { st.w = Math.min(.9, Math.max(.05, w)); ps(); };
        let rs = null;
        rz.onpointerdown = e => { e.stopPropagation(); rs = { x: e.clientX, w: st.w }; rz.setPointerCapture(e.pointerId); };
        rz.onpointermove = e => { if (rs) big(rs.w + (e.clientX - rs.x) * 2 / innerWidth); };
        rz.onpointerup = () => { rs = null; sv(); };
        el.onwheel = e => { if (st.fijo) return; e.preventDefault(); big(st.w * (e.deltaY < 0 ? 1.08 : .926)); sv(); };
        let d = null;
        el.onpointerdown = e => { d = { x: e.clientX, y: e.clientY, m: false }; el.setPointerCapture(e.pointerId); };
        el.onpointermove = e => {
            if (!d || st.fijo) return;
            if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.m = true;
            if (d.m) { st.x = Math.min(.97, Math.max(.03, e.clientX / innerWidth)); st.y = Math.min(.97, Math.max(.03, e.clientY / innerHeight)); ps(); }
        };
        el.onpointerup = () => { if (!d) return; if (!d.m) st.fijo = !st.fijo; d = null; sv(); ps(); };
        ps();
        document.body.appendChild(el);
    }

    /* Las bocinas marcadas del proyecto se mueven con graves, medios y agudos (igual que el chuchero). */
    function anim(cv, im, cs) {
        const x = cv.getContext("2d"), W = cv.width, H = cv.height;
        let was = true;
        const f = () => {
            if (!cv.isConnected) return;
            requestAnimationFrame(f);
            const on = cs.some(c => spkL[c.k] > 0);
            if (!on && !was) return;
            was = on;
            x.clearRect(0, 0, W, H);
            x.drawImage(im, 0, 0);
            for (const c of cs) {
                const v = spkL[c.k];
                if (!(v > 0)) continue;
                const cx = c.x * W, cy = c.y * H, R = c.r * W, big = c.k === "b";
                const z = (r, s) => { x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.clip(); x.translate(cx, cy); x.scale(s, s); x.translate(-cx, -cy); x.drawImage(im, 0, 0); x.restore(); };
                z(R, 1 + v * (big ? .075 : .05));
                z(R * .55, 1 + v * (big ? .16 : .11));
                const gr = x.createRadialGradient(cx, cy, R * .55, cx, cy, R);
                gr.addColorStop(0, "rgba(0,0,0,0)");
                gr.addColorStop(1, "rgba(0,0,0," + (.34 * v) + ")");
                x.fillStyle = gr;
                x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.fill();
            }
        };
        f();
    }

    /* Marcar bocinas: toca el centro y luego el borde de cada una */
    async function marcar(id) {
        const my0 = gen;
        if (!inv.find(x => x.id === id)) await refresh();
        if (my0 !== gen) return;
        const p = inv.find(x => x.id === id);
        if (!p) return admin("No se encontr\u00f3 el proyecto.");
        await imgOf(p);   /* la imagen se pide aqu\u00ed, ANTES de abrir el panel */
        if (my0 !== gen) return;
        const c = card("prj"), wrap = E("div", "prmk"), im = E("img"), ov = E("div", "prov"), info = E("div", "vs"), sv2 = E("button", "acsub", "Guardar bocinas"), un = E("button", "acout", "Deshacer"), au = E("button", "acsub", "\uD83D\uDD0D Detectar autom\u00e1ticamente"), bk = E("button", "acout", "\u2190 Volver");
        au.type = "button";
        let cs = (p.conos || []).slice(), pt = null;
        im.src = p.imagen || ""; im.draggable = false; sv2.type = un.type = bk.type = "button";
        wrap.append(im, ov);
        const paint = () => {
            ov.textContent = "";
            cs.forEach(k => { const d = E("i", "k" + k.k); d.style.cssText = "left:" + k.x * 100 + "%;top:" + k.y * 100 + "%;width:" + k.r * 200 + "%"; ov.appendChild(d); });
            if (pt) { const d = E("i", "dot"); d.style.cssText = "left:" + pt.x * 100 + "%;top:" + pt.y * 100 + "%"; ov.appendChild(d); }
            info.textContent = pt ? "Ahora toca el borde de esa bocina." : cs.length + " bocina(s) marcadas. Toca el centro de otra.";
        };
        ov.onpointerdown = e => {
            const r = ov.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
            if (!pt) pt = { x, y };
            else {
                const rad = Math.hypot((x - pt.x) * r.width, (y - pt.y) * r.height) / r.width;
                if (rad > .015 && cs.length < 12) cs.push({ x: +pt.x.toFixed(4), y: +pt.y.toFixed(4), r: +rad.toFixed(4), k: rad >= .11 ? "b" : rad >= .06 ? "m" : "t" });
                pt = null;
            }
            paint();
        };
        un.onclick = () => { if (pt) pt = null; else cs.pop(); paint(); };
        au.onclick = async () => {
            au.classList.add("ld"); pt = null;
            const r = await detectar(p.imagen); au.classList.remove("ld");
            if (r.length) { cs = r; paint(); info.textContent = "Detect\u00e9 " + r.length + " bocina(s). Ajusta o guarda."; }
            else info.textContent = "No detect\u00e9 bocinas; m\u00e1rcalas a mano.";
        };
        sv2.onclick = async () => {
            sv2.classList.add("ld");
            const my = gen;
            try { await R("admin_conos", { p_proyecto: id, p_conos: cs }); await refresh(); if (alive(my)) admin("\u2705 Bocinas guardadas."); }
            catch (e) { sv2.classList.remove("ld"); info.textContent = msg(e); }
        };
        bk.onclick = () => admin();
        c.append(E("div", "ach", "\uD83D\uDD0A"), E("h2", "", "Marcar bocinas"), E("p", "vs", "Toca el centro de cada bocina y luego su borde. Las grandes se mueven con los graves, las medianas con los medios y las chicas con los agudos."), wrap, info, au, sv2, un, bk);
        paint();
    }

    /* Detecta las bocinas de una imagen (data URL o URL del mismo origen) */
    const detectar = src => new Promise(res => {
        const im = new Image();
        im.onload = () => {
            try {
                const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
                const cx = cv.getContext("2d"); cx.drawImage(im, 0, 0);
                res(detectarBocinas(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, 12).slice(0, 12));
            } catch (e) { res([]); }
        };
        im.onerror = () => res([]);
        im.src = src;
    });

    /* Proyectos que viven DENTRO del c\u00f3digo (imagen en alta calidad, sin pasar por la base de datos). "quien" = usuarios que lo ven.
       OJO: la imagen es un archivo de la p\u00e1gina; esconde el proyecto de la lista, pero no es secreta si alguien conoce su direcci\u00f3n. */
    const LOCALES = [
        { id: "local-yerulin", nombre: "La Yerulin", tipo: "imagen", imagen: "assets/img/proyectos/la-yerulin.webp", quien: ["ricky", "sxtn", "menolmusic", "sox1"], conos: [{"x":0.4539,"y":0.3696,"r":0.0288,"k":"b"},{"x":0.5449,"y":0.3696,"r":0.0288,"k":"b"},{"x":0.4542,"y":0.5304,"r":0.0301,"k":"b"},{"x":0.5449,"y":0.5304,"r":0.0302,"k":"b"},{"x":0.4079,"y":0.2916,"r":0.015,"k":"m"},{"x":0.4622,"y":0.2916,"r":0.015,"k":"m"},{"x":0.5387,"y":0.2916,"r":0.015,"k":"m"},{"x":0.593,"y":0.2915,"r":0.015,"k":"m"},{"x":0.33,"y":0.1886,"r":0.0095,"k":"t"},{"x":0.3525,"y":0.1886,"r":0.0095,"k":"t"},{"x":0.646,"y":0.1886,"r":0.0095,"k":"t"},{"x":0.6685,"y":0.1886,"r":0.0095,"k":"t"}] },
        { id: "local-camioneta", nombre: "Camioneta azul", tipo: "imagen", imagen: "assets/img/proyectos/camioneta-azul.webp", quien: ["ricky"], conos: [{"x":0.6061,"y":0.2191,"r":0.0308,"k":"b"},{"x":0.6819,"y":0.2212,"r":0.0304,"k":"b"},{"x":0.5939,"y":0.498,"r":0.03,"k":"b"},{"x":0.5957,"y":0.6642,"r":0.03,"k":"b"},{"x":0.6569,"y":0.6575,"r":0.03,"k":"b"},{"x":0.5797,"y":0.3584,"r":0.024,"k":"m"},{"x":0.7085,"y":0.4087,"r":0.024,"k":"m"},{"x":0.6501,"y":0.4834,"r":0.024,"k":"m"},{"x":0.643,"y":0.3162,"r":0.014,"k":"t"},{"x":0.72,"y":0.3162,"r":0.014,"k":"t"},{"x":0.6685,"y":0.3805,"r":0.014,"k":"t"},{"x":0.715,"y":0.5039,"r":0.014,"k":"t"}] },
        { id: "local-coqueta", nombre: "La Coqueta", tipo: "imagen", imagen: "assets/img/proyectos/la-coqueta.webp", quien: ["mononegro1"], conos: [{"x":0.6695,"y":0.4432,"r":0.0357,"k":"b"},{"x":0.5932,"y":0.5971,"r":0.0406,"k":"b"},{"x":0.5889,"y":0.7417,"r":0.0412,"k":"b"},{"x":0.6511,"y":0.5496,"r":0.0234,"k":"b"},{"x":0.5785,"y":0.439,"r":0.0222,"k":"m"},{"x":0.7077,"y":0.5816,"r":0.0234,"k":"m"},{"x":0.64,"y":0.6787,"r":0.0234,"k":"m"},{"x":0.6166,"y":0.405,"r":0.0148,"k":"m"},{"x":0.616,"y":0.4587,"r":0.0111,"k":"t"},{"x":0.6892,"y":0.5238,"r":0.0098,"k":"t"},{"x":0.7126,"y":0.5031,"r":0.0098,"k":"t"},{"x":0.6597,"y":0.7407,"r":0.0098,"k":"t"}] },
        { id: "local-bandida", nombre: "La Bandida", tipo: "imagen", imagen: "assets/img/proyectos/la-bandida.webp", quien: ["ryzenbass"], conos: [{"x":0.3986,"y":0.0663,"r":0.0192,"k":"t"},{"x":0.602,"y":0.0664,"r":0.0194,"k":"t"},{"x":0.2309,"y":0.101,"r":0.0515,"k":"b"},{"x":0.3403,"y":0.0912,"r":0.0423,"k":"b"},{"x":0.458,"y":0.0929,"r":0.042,"k":"b"},{"x":0.5432,"y":0.093,"r":0.0421,"k":"b"},{"x":0.6602,"y":0.0912,"r":0.0423,"k":"b"},{"x":0.7685,"y":0.101,"r":0.0515,"k":"b"},{"x":0.321,"y":0.1549,"r":0.0192,"k":"t"},{"x":0.451,"y":0.1575,"r":0.0192,"k":"t"},{"x":0.4992,"y":0.1587,"r":0.023,"k":"m"},{"x":0.549,"y":0.1574,"r":0.0192,"k":"t"},{"x":0.6789,"y":0.155,"r":0.0192,"k":"t"},{"x":0.2019,"y":0.1865,"r":0.023,"k":"m"},{"x":0.2584,"y":0.1865,"r":0.023,"k":"m"},{"x":0.3842,"y":0.1764,"r":0.0423,"k":"b"},{"x":0.6147,"y":0.1764,"r":0.0423,"k":"b"},{"x":0.7411,"y":0.1865,"r":0.023,"k":"m"},{"x":0.7976,"y":0.1865,"r":0.023,"k":"m"},{"x":0.3211,"y":0.1979,"r":0.0192,"k":"t"},{"x":0.458,"y":0.2239,"r":0.0421,"k":"b"},{"x":0.5432,"y":0.2239,"r":0.0424,"k":"b"},{"x":0.6789,"y":0.198,"r":0.0192,"k":"t"},{"x":0.1973,"y":0.2367,"r":0.0194,"k":"t"},{"x":0.8021,"y":0.2366,"r":0.0194,"k":"t"},{"x":0.2693,"y":0.2777,"r":0.0517,"k":"b"},{"x":0.3842,"y":0.2592,"r":0.023,"k":"m"},{"x":0.4992,"y":0.2847,"r":0.023,"k":"m"},{"x":0.6159,"y":0.2592,"r":0.023,"k":"m"},{"x":0.7302,"y":0.2777,"r":0.0517,"k":"b"},{"x":0.1973,"y":0.3058,"r":0.0194,"k":"t"},{"x":0.4359,"y":0.2968,"r":0.023,"k":"m"},{"x":0.5612,"y":0.2968,"r":0.023,"k":"m"},{"x":0.8022,"y":0.3058,"r":0.0194,"k":"t"},{"x":0.3071,"y":0.3444,"r":0.0194,"k":"t"},{"x":0.6923,"y":0.3445,"r":0.0195,"k":"t"},{"x":0.2002,"y":0.3564,"r":0.023,"k":"m"},{"x":0.3867,"y":0.358,"r":0.0421,"k":"b"},{"x":0.451,"y":0.347,"r":0.0192,"k":"t"},{"x":0.4992,"y":0.3475,"r":0.023,"k":"m"},{"x":0.5489,"y":0.3469,"r":0.0192,"k":"t"},{"x":0.6123,"y":0.3579,"r":0.0421,"k":"b"},{"x":0.7993,"y":0.3564,"r":0.023,"k":"m"},{"x":0.2693,"y":0.4113,"r":0.0517,"k":"b"},{"x":0.382,"y":0.4306,"r":0.0192,"k":"t"},{"x":0.458,"y":0.418,"r":0.042,"k":"b"},{"x":0.5432,"y":0.418,"r":0.0421,"k":"b"},{"x":0.6184,"y":0.4305,"r":0.0194,"k":"t"},{"x":0.7302,"y":0.4113,"r":0.0517,"k":"b"},{"x":0.195,"y":0.443,"r":0.0192,"k":"t"},{"x":0.8045,"y":0.4429,"r":0.0192,"k":"t"}] },
        { id: "local-menolmemoria1", nombre: "MenolMemoria1", tipo: "imagen", imagen: "assets/img/proyectos/menolmemoria1.webp", quien: ["menolmemoria"], conos: [{"x":0.1515,"y":0.3502,"r":0.0222,"k":"b"},{"x":0.2266,"y":0.3506,"r":0.0225,"k":"b"},{"x":0.2912,"y":0.3506,"r":0.0219,"k":"b"},{"x":0.3608,"y":0.3506,"r":0.0222,"k":"b"},{"x":0.4086,"y":0.3506,"r":0.0222,"k":"b"},{"x":0.4758,"y":0.3506,"r":0.0228,"k":"b"},{"x":0.5235,"y":0.3505,"r":0.0225,"k":"b"},{"x":0.5909,"y":0.3505,"r":0.0219,"k":"b"},{"x":0.6387,"y":0.3506,"r":0.0222,"k":"b"},{"x":0.7083,"y":0.3505,"r":0.0222,"k":"b"},{"x":0.7729,"y":0.3505,"r":0.0222,"k":"b"},{"x":0.8476,"y":0.3502,"r":0.0222,"k":"b"},{"x":0.2028,"y":0.398,"r":0.008,"k":"t"},{"x":0.3149,"y":0.398,"r":0.0084,"k":"t"},{"x":0.4203,"y":0.4024,"r":0.0222,"k":"b"},{"x":0.4673,"y":0.4024,"r":0.0225,"k":"b"},{"x":0.5328,"y":0.4024,"r":0.0219,"k":"b"},{"x":0.5799,"y":0.4025,"r":0.0222,"k":"b"},{"x":0.6846,"y":0.3977,"r":0.008,"k":"t"},{"x":0.7962,"y":0.3979,"r":0.0077,"k":"t"},{"x":0.1514,"y":0.4089,"r":0.0264,"k":"b"},{"x":0.2495,"y":0.4089,"r":0.0267,"k":"b"},{"x":0.3656,"y":0.4103,"r":0.0267,"k":"b"},{"x":0.6343,"y":0.4103,"r":0.0264,"k":"b"},{"x":0.7499,"y":0.4089,"r":0.0267,"k":"b"},{"x":0.848,"y":0.4089,"r":0.0267,"k":"b"},{"x":0.2029,"y":0.4563,"r":0.008,"k":"t"},{"x":0.3148,"y":0.4564,"r":0.008,"k":"t"},{"x":0.4191,"y":0.4473,"r":0.0077,"k":"t"},{"x":0.4536,"y":0.442,"r":0.0077,"k":"t"},{"x":0.4846,"y":0.442,"r":0.0077,"k":"t"},{"x":0.5154,"y":0.442,"r":0.0077,"k":"t"},{"x":0.5463,"y":0.4419,"r":0.0077,"k":"t"},{"x":0.5811,"y":0.4472,"r":0.0077,"k":"t"},{"x":0.6845,"y":0.4564,"r":0.0084,"k":"t"},{"x":0.7964,"y":0.4564,"r":0.0084,"k":"t"},{"x":0.3655,"y":0.473,"r":0.0267,"k":"b"},{"x":0.6345,"y":0.4731,"r":0.0267,"k":"b"},{"x":0.4135,"y":0.4804,"r":0.008,"k":"t"},{"x":0.4662,"y":0.4824,"r":0.0222,"k":"b"},{"x":0.5342,"y":0.4825,"r":0.0222,"k":"b"},{"x":0.5866,"y":0.4806,"r":0.0077,"k":"t"},{"x":0.1514,"y":0.4934,"r":0.0264,"k":"b"},{"x":0.2028,"y":0.4932,"r":0.0077,"k":"t"},{"x":0.2496,"y":0.4931,"r":0.0267,"k":"b"},{"x":0.315,"y":0.4929,"r":0.0077,"k":"t"},{"x":0.6846,"y":0.4931,"r":0.008,"k":"t"},{"x":0.7498,"y":0.4931,"r":0.0264,"k":"b"},{"x":0.7965,"y":0.4929,"r":0.008,"k":"t"},{"x":0.8478,"y":0.4933,"r":0.0267,"k":"b"},{"x":0.3575,"y":0.5211,"r":0.0084,"k":"t"},{"x":0.3924,"y":0.5108,"r":0.008,"k":"t"},{"x":0.4318,"y":0.5171,"r":0.0222,"k":"b"},{"x":0.5682,"y":0.5171,"r":0.0222,"k":"b"},{"x":0.6081,"y":0.5108,"r":0.0077,"k":"t"},{"x":0.6425,"y":0.5206,"r":0.008,"k":"t"},{"x":0.2031,"y":0.5298,"r":0.0084,"k":"t"},{"x":0.3147,"y":0.5296,"r":0.008,"k":"t"},{"x":0.4762,"y":0.5328,"r":0.0225,"k":"b"},{"x":0.524,"y":0.5327,"r":0.0222,"k":"b"},{"x":0.6848,"y":0.5294,"r":0.0084,"k":"t"},{"x":0.7961,"y":0.5297,"r":0.008,"k":"t"},{"x":0.4441,"y":0.5581,"r":0.008,"k":"t"},{"x":0.5566,"y":0.5582,"r":0.0077,"k":"t"},{"x":0.1515,"y":0.5781,"r":0.0264,"k":"b"},{"x":0.2028,"y":0.5885,"r":0.0077,"k":"t"},{"x":0.2497,"y":0.5776,"r":0.0267,"k":"b"},{"x":0.3149,"y":0.588,"r":0.008,"k":"t"},{"x":0.3805,"y":0.5784,"r":0.0261,"k":"b"},{"x":0.4762,"y":0.5838,"r":0.0225,"k":"b"},{"x":0.5241,"y":0.5838,"r":0.0222,"k":"b"},{"x":0.6195,"y":0.5783,"r":0.0261,"k":"b"},{"x":0.6845,"y":0.5884,"r":0.008,"k":"t"},{"x":0.75,"y":0.5777,"r":0.0267,"k":"b"},{"x":0.7965,"y":0.5884,"r":0.0074,"k":"t"},{"x":0.8478,"y":0.5781,"r":0.0264,"k":"b"}] },
        { id: "local-menolmemoria2", nombre: "MenolMemoria2", tipo: "imagen", imagen: "assets/img/proyectos/menolmemoria2.webp", quien: ["menolmemoria"], conos: [{"x":0.4999,"y":0.3202,"r":0.0116,"k":"t"},{"x":0.262,"y":0.3665,"r":0.0119,"k":"t"},{"x":0.4996,"y":0.3666,"r":0.0122,"k":"t"},{"x":0.7371,"y":0.3662,"r":0.0119,"k":"t"},{"x":0.323,"y":0.38,"r":0.0312,"k":"b"},{"x":0.4316,"y":0.385,"r":0.038,"k":"b"},{"x":0.5676,"y":0.385,"r":0.0376,"k":"b"},{"x":0.6758,"y":0.38,"r":0.0312,"k":"b"},{"x":0.262,"y":0.4402,"r":0.0119,"k":"t"},{"x":0.4997,"y":0.4405,"r":0.0119,"k":"t"},{"x":0.7371,"y":0.4402,"r":0.0122,"k":"t"},{"x":0.3231,"y":0.4497,"r":0.0312,"k":"b"},{"x":0.6758,"y":0.4498,"r":0.0312,"k":"b"},{"x":0.262,"y":0.4844,"r":0.0119,"k":"t"},{"x":0.4997,"y":0.4841,"r":0.0119,"k":"t"},{"x":0.7371,"y":0.4843,"r":0.0119,"k":"t"},{"x":0.4314,"y":0.5006,"r":0.0376,"k":"b"},{"x":0.5676,"y":0.5008,"r":0.0373,"k":"b"},{"x":0.3231,"y":0.5192,"r":0.0312,"k":"b"},{"x":0.6759,"y":0.5192,"r":0.0312,"k":"b"},{"x":0.2617,"y":0.529,"r":0.0122,"k":"t"},{"x":0.4996,"y":0.5288,"r":0.0122,"k":"t"},{"x":0.737,"y":0.5285,"r":0.0119,"k":"t"},{"x":0.3232,"y":0.5887,"r":0.0312,"k":"b"},{"x":0.4314,"y":0.5839,"r":0.0389,"k":"b"},{"x":0.5676,"y":0.5837,"r":0.0373,"k":"b"},{"x":0.6759,"y":0.5889,"r":0.0312,"k":"b"},{"x":0.2619,"y":0.6022,"r":0.0119,"k":"t"},{"x":0.4994,"y":0.6025,"r":0.0122,"k":"t"},{"x":0.7372,"y":0.6025,"r":0.0122,"k":"t"}] },
        { id: "local-menolmemoria3", nombre: "MenolMemoria3", tipo: "imagen", imagen: "assets/img/proyectos/menolmemoria3.webp", quien: ["menolmemoria"], conos: [{"x":0.2177,"y":0.0842,"r":0.0166,"k":"m"},{"x":0.2816,"y":0.0839,"r":0.016,"k":"m"},{"x":0.3292,"y":0.0836,"r":0.0162,"k":"m"},{"x":0.3979,"y":0.0831,"r":0.0156,"k":"m"},{"x":0.4674,"y":0.083,"r":0.0158,"k":"m"},{"x":0.5369,"y":0.0829,"r":0.016,"k":"m"},{"x":0.6052,"y":0.0828,"r":0.0156,"k":"m"},{"x":0.6721,"y":0.0834,"r":0.016,"k":"m"},{"x":0.7196,"y":0.084,"r":0.016,"k":"m"},{"x":0.7819,"y":0.084,"r":0.016,"k":"m"},{"x":0.1313,"y":0.0984,"r":0.0337,"k":"b"},{"x":0.8673,"y":0.0982,"r":0.0337,"k":"b"},{"x":0.1927,"y":0.1621,"r":0.0156,"k":"m"},{"x":0.8066,"y":0.1619,"r":0.0154,"k":"m"},{"x":0.131,"y":0.204,"r":0.0327,"k":"b"},{"x":0.8678,"y":0.2041,"r":0.0329,"k":"b"},{"x":0.3387,"y":0.2089,"r":0.0339,"k":"b"},{"x":0.6644,"y":0.2089,"r":0.0339,"k":"b"},{"x":0.1931,"y":0.2393,"r":0.0158,"k":"m"},{"x":0.8067,"y":0.239,"r":0.0152,"k":"m"},{"x":0.3958,"y":0.2696,"r":0.0164,"k":"m"},{"x":0.6061,"y":0.269,"r":0.0164,"k":"m"},{"x":0.3387,"y":0.2766,"r":0.0339,"k":"b"},{"x":0.461,"y":0.2884,"r":0.0371,"k":"b"},{"x":0.5411,"y":0.2882,"r":0.037,"k":"b"},{"x":0.6644,"y":0.2766,"r":0.0339,"k":"b"},{"x":0.131,"y":0.308,"r":0.0331,"k":"b"},{"x":0.8681,"y":0.3078,"r":0.0333,"k":"b"},{"x":0.1927,"y":0.3157,"r":0.0156,"k":"m"},{"x":0.3957,"y":0.3122,"r":0.0158,"k":"m"},{"x":0.6064,"y":0.3117,"r":0.0158,"k":"m"},{"x":0.8069,"y":0.3154,"r":0.0154,"k":"m"},{"x":0.3387,"y":0.3427,"r":0.0339,"k":"b"},{"x":0.6644,"y":0.3427,"r":0.0339,"k":"b"},{"x":0.3954,"y":0.3801,"r":0.016,"k":"m"},{"x":0.6064,"y":0.3796,"r":0.016,"k":"m"},{"x":0.1927,"y":0.3922,"r":0.0158,"k":"m"},{"x":0.8073,"y":0.392,"r":0.015,"k":"m"},{"x":0.131,"y":0.4118,"r":0.0331,"k":"b"},{"x":0.3387,"y":0.4104,"r":0.0339,"k":"b"},{"x":0.3958,"y":0.4226,"r":0.0162,"k":"m"},{"x":0.6064,"y":0.4221,"r":0.016,"k":"m"},{"x":0.6644,"y":0.4104,"r":0.0339,"k":"b"},{"x":0.868,"y":0.4119,"r":0.0331,"k":"b"}] },
        { id: "local-menolmemoria4", nombre: "MenolMemoria4", tipo: "imagen", imagen: "assets/img/proyectos/menolmemoria4.webp", quien: ["menolmemoria"], conos: [{"x":0.1903,"y":0.1953,"r":0.0099,"k":"m"},{"x":0.2932,"y":0.2053,"r":0.0182,"k":"b"},{"x":0.3486,"y":0.2051,"r":0.0183,"k":"b"},{"x":0.3872,"y":0.2052,"r":0.0182,"k":"b"},{"x":0.4426,"y":0.2054,"r":0.0185,"k":"b"},{"x":0.4813,"y":0.2052,"r":0.0182,"k":"b"},{"x":0.5205,"y":0.2054,"r":0.0183,"k":"b"},{"x":0.5592,"y":0.2053,"r":0.0183,"k":"b"},{"x":0.614,"y":0.2053,"r":0.018,"k":"b"},{"x":0.6525,"y":0.2052,"r":0.0183,"k":"b"},{"x":0.707,"y":0.2057,"r":0.0183,"k":"b"},{"x":0.8852,"y":0.1957,"r":0.0101,"k":"m"},{"x":0.0759,"y":0.212,"r":0.0233,"k":"b"},{"x":0.1519,"y":0.2119,"r":0.0231,"k":"b"},{"x":0.2281,"y":0.212,"r":0.0231,"k":"b"},{"x":0.7714,"y":0.2122,"r":0.0231,"k":"b"},{"x":0.8475,"y":0.2121,"r":0.0231,"k":"b"},{"x":0.9232,"y":0.212,"r":0.0231,"k":"b"},{"x":0.0758,"y":0.274,"r":0.0231,"k":"b"},{"x":0.1518,"y":0.2742,"r":0.0229,"k":"b"},{"x":0.228,"y":0.2741,"r":0.0229,"k":"b"},{"x":0.7713,"y":0.2744,"r":0.0231,"k":"b"},{"x":0.8474,"y":0.2741,"r":0.0229,"k":"b"},{"x":0.9231,"y":0.2742,"r":0.0229,"k":"b"},{"x":0.2942,"y":0.284,"r":0.0187,"k":"b"},{"x":0.3612,"y":0.2864,"r":0.0199,"k":"b"},{"x":0.441,"y":0.2867,"r":0.0201,"k":"b"},{"x":0.4804,"y":0.2864,"r":0.0201,"k":"b"},{"x":0.5199,"y":0.2864,"r":0.0201,"k":"b"},{"x":0.5593,"y":0.2865,"r":0.0201,"k":"b"},{"x":0.599,"y":0.2865,"r":0.0201,"k":"b"},{"x":0.6387,"y":0.2866,"r":0.0199,"k":"b"},{"x":0.706,"y":0.284,"r":0.0189,"k":"b"},{"x":0.9665,"y":0.281,"r":0.0155,"k":"m"},{"x":0.1137,"y":0.2952,"r":0.0099,"k":"m"},{"x":0.9665,"y":0.3218,"r":0.0153,"k":"m"},{"x":0.0757,"y":0.3354,"r":0.0229,"k":"b"},{"x":0.1517,"y":0.3355,"r":0.0228,"k":"b"},{"x":0.228,"y":0.3355,"r":0.0228,"k":"b"},{"x":0.2941,"y":0.334,"r":0.0187,"k":"b"},{"x":0.4408,"y":0.3273,"r":0.0097,"k":"m"},{"x":0.4801,"y":0.3274,"r":0.0097,"k":"m"},{"x":0.5197,"y":0.3274,"r":0.0097,"k":"m"},{"x":0.5989,"y":0.3274,"r":0.0097,"k":"m"},{"x":0.6389,"y":0.3271,"r":0.0097,"k":"m"},{"x":0.7056,"y":0.334,"r":0.0185,"k":"b"},{"x":0.7712,"y":0.3357,"r":0.0229,"k":"b"},{"x":0.8474,"y":0.3355,"r":0.0229,"k":"b"},{"x":0.923,"y":0.3355,"r":0.0228,"k":"b"},{"x":0.3611,"y":0.3662,"r":0.0191,"k":"b"},{"x":0.4011,"y":0.3663,"r":0.0191,"k":"b"},{"x":0.4411,"y":0.3665,"r":0.0191,"k":"b"},{"x":0.4804,"y":0.3665,"r":0.0189,"k":"b"},{"x":0.5199,"y":0.3664,"r":0.0191,"k":"b"},{"x":0.5594,"y":0.3663,"r":0.0189,"k":"b"},{"x":0.5988,"y":0.3664,"r":0.0191,"k":"b"},{"x":0.6386,"y":0.3662,"r":0.0189,"k":"b"},{"x":0.2942,"y":0.3824,"r":0.0185,"k":"b"},{"x":0.7054,"y":0.3824,"r":0.0183,"k":"b"},{"x":0.0757,"y":0.3969,"r":0.0233,"k":"b"},{"x":0.1517,"y":0.397,"r":0.0231,"k":"b"},{"x":0.2279,"y":0.3971,"r":0.0231,"k":"b"},{"x":0.4006,"y":0.406,"r":0.0099,"k":"m"},{"x":0.4406,"y":0.4059,"r":0.0101,"k":"m"},{"x":0.4803,"y":0.4058,"r":0.0102,"k":"m"},{"x":0.5197,"y":0.4059,"r":0.0099,"k":"m"},{"x":0.5594,"y":0.4058,"r":0.0101,"k":"m"},{"x":0.5989,"y":0.4055,"r":0.0099,"k":"m"},{"x":0.6388,"y":0.4055,"r":0.0104,"k":"m"},{"x":0.7712,"y":0.3973,"r":0.0231,"k":"b"},{"x":0.8474,"y":0.3969,"r":0.0233,"k":"b"},{"x":0.923,"y":0.397,"r":0.0233,"k":"b"},{"x":0.2943,"y":0.4302,"r":0.0185,"k":"b"},{"x":0.7052,"y":0.43,"r":0.0185,"k":"b"},{"x":0.9661,"y":0.4398,"r":0.0157,"k":"m"},{"x":0.3611,"y":0.446,"r":0.0189,"k":"b"},{"x":0.401,"y":0.4461,"r":0.0189,"k":"b"},{"x":0.4409,"y":0.446,"r":0.0189,"k":"b"},{"x":0.4804,"y":0.446,"r":0.0187,"k":"b"},{"x":0.52,"y":0.446,"r":0.0187,"k":"b"},{"x":0.5594,"y":0.4461,"r":0.0187,"k":"b"},{"x":0.5989,"y":0.446,"r":0.0187,"k":"b"},{"x":0.6386,"y":0.4459,"r":0.0187,"k":"b"},{"x":0.0757,"y":0.4591,"r":0.0231,"k":"b"},{"x":0.1516,"y":0.4591,"r":0.0229,"k":"b"},{"x":0.228,"y":0.4592,"r":0.0231,"k":"b"},{"x":0.7712,"y":0.4593,"r":0.0231,"k":"b"},{"x":0.8474,"y":0.4592,"r":0.0229,"k":"b"},{"x":0.923,"y":0.4592,"r":0.0229,"k":"b"},{"x":0.2944,"y":0.4778,"r":0.0185,"k":"b"},{"x":0.4005,"y":0.4852,"r":0.0097,"k":"m"},{"x":0.441,"y":0.4851,"r":0.0097,"k":"m"},{"x":0.4798,"y":0.4854,"r":0.0097,"k":"m"},{"x":0.599,"y":0.4853,"r":0.0101,"k":"m"},{"x":0.6388,"y":0.4852,"r":0.0097,"k":"m"},{"x":0.7052,"y":0.4777,"r":0.0185,"k":"b"},{"x":0.9663,"y":0.4807,"r":0.0155,"k":"m"},{"x":0.0756,"y":0.5205,"r":0.0231,"k":"b"},{"x":0.1516,"y":0.5208,"r":0.0231,"k":"b"},{"x":0.2279,"y":0.5208,"r":0.0229,"k":"b"},{"x":0.7712,"y":0.5208,"r":0.0229,"k":"b"},{"x":0.8473,"y":0.5207,"r":0.0231,"k":"b"},{"x":0.923,"y":0.5208,"r":0.0229,"k":"b"},{"x":0.2944,"y":0.5258,"r":0.0187,"k":"b"},{"x":0.3611,"y":0.5258,"r":0.0191,"k":"b"},{"x":0.4011,"y":0.5259,"r":0.0189,"k":"b"},{"x":0.4409,"y":0.5258,"r":0.0191,"k":"b"},{"x":0.4803,"y":0.5258,"r":0.0191,"k":"b"},{"x":0.5199,"y":0.5258,"r":0.0189,"k":"b"},{"x":0.5593,"y":0.5257,"r":0.0191,"k":"b"},{"x":0.5988,"y":0.5256,"r":0.0191,"k":"b"},{"x":0.6385,"y":0.5257,"r":0.0191,"k":"b"},{"x":0.7052,"y":0.5259,"r":0.0187,"k":"b"},{"x":0.9663,"y":0.5252,"r":0.0171,"k":"m"},{"x":0.2657,"y":0.6133,"r":0.0228,"k":"b"},{"x":0.3163,"y":0.6134,"r":0.0231,"k":"b"},{"x":0.291,"y":0.6442,"r":0.012,"k":"m"},{"x":0.3162,"y":0.6751,"r":0.0231,"k":"b"},{"x":0.2657,"y":0.7372,"r":0.0233,"k":"b"},{"x":0.3162,"y":0.7372,"r":0.0233,"k":"b"},{"x":0.7831,"y":0.7372,"r":0.0233,"k":"b"},{"x":0.3162,"y":0.8002,"r":0.0235,"k":"b"},{"x":0.7831,"y":0.7999,"r":0.0235,"k":"b"},{"x":0.2403,"y":0.8317,"r":0.0115,"k":"m"},{"x":0.2906,"y":0.8318,"r":0.0124,"k":"m"},{"x":0.2155,"y":0.864,"r":0.0235,"k":"b"},{"x":0.2656,"y":0.8637,"r":0.0235,"k":"b"},{"x":0.316,"y":0.8636,"r":0.0236,"k":"b"},{"x":0.6825,"y":0.8635,"r":0.0238,"k":"b"},{"x":0.7331,"y":0.8634,"r":0.0235,"k":"b"}] },
        { id: "local-supernazy", nombre: "La Super Nazy", tipo: "imagen", imagen: "assets/img/proyectos/la-super-nazy.webp", quien: ["ricky", "eryy044"], conos: [{"x":0.306,"y":0.1124,"r":0.0131,"k":"b"},{"x":0.3488,"y":0.1121,"r":0.0125,"k":"m"},{"x":0.5482,"y":0.111,"r":0.0104,"k":"m"},{"x":0.3946,"y":0.1184,"r":0.0169,"k":"b"},{"x":0.4611,"y":0.1184,"r":0.0169,"k":"b"},{"x":0.4976,"y":0.1162,"r":0.0152,"k":"b"},{"x":0.5789,"y":0.1184,"r":0.0169,"k":"b"},{"x":0.6387,"y":0.1184,"r":0.0169,"k":"b"},{"x":0.6854,"y":0.113,"r":0.0135,"k":"b"},{"x":0.7361,"y":0.1129,"r":0.0135,"k":"b"},{"x":0.306,"y":0.168,"r":0.0131,"k":"b"},{"x":0.3489,"y":0.1674,"r":0.0125,"k":"m"},{"x":0.3946,"y":0.1804,"r":0.0169,"k":"b"},{"x":0.4611,"y":0.1804,"r":0.0169,"k":"b"},{"x":0.4975,"y":0.1797,"r":0.0152,"k":"b"},{"x":0.5483,"y":0.1653,"r":0.0103,"k":"m"},{"x":0.5789,"y":0.1804,"r":0.0169,"k":"b"},{"x":0.6387,"y":0.1804,"r":0.0169,"k":"b"},{"x":0.6855,"y":0.1682,"r":0.0135,"k":"b"},{"x":0.7361,"y":0.1684,"r":0.0137,"k":"b"},{"x":0.306,"y":0.2236,"r":0.0131,"k":"b"},{"x":0.3488,"y":0.2232,"r":0.0128,"k":"b"},{"x":0.3946,"y":0.2458,"r":0.0169,"k":"b"},{"x":0.4611,"y":0.2458,"r":0.0169,"k":"b"},{"x":0.4976,"y":0.2456,"r":0.0152,"k":"b"},{"x":0.5483,"y":0.2166,"r":0.01,"k":"m"},{"x":0.5789,"y":0.2458,"r":0.0169,"k":"b"},{"x":0.6387,"y":0.2458,"r":0.0169,"k":"b"},{"x":0.6855,"y":0.2242,"r":0.0135,"k":"b"},{"x":0.7361,"y":0.2241,"r":0.0135,"k":"b"},{"x":0.306,"y":0.2788,"r":0.0131,"k":"b"},{"x":0.3487,"y":0.2785,"r":0.0125,"k":"m"},{"x":0.5483,"y":0.2661,"r":0.0099,"k":"m"},{"x":0.6854,"y":0.2794,"r":0.0135,"k":"b"},{"x":0.7361,"y":0.2795,"r":0.0135,"k":"b"},{"x":0.306,"y":0.3343,"r":0.0132,"k":"b"},{"x":0.3488,"y":0.3338,"r":0.0127,"k":"b"},{"x":0.3946,"y":0.31,"r":0.0169,"k":"b"},{"x":0.4611,"y":0.31,"r":0.0169,"k":"b"},{"x":0.4976,"y":0.3124,"r":0.0155,"k":"b"},{"x":0.5483,"y":0.3177,"r":0.0104,"k":"m"},{"x":0.5789,"y":0.31,"r":0.0169,"k":"b"},{"x":0.6387,"y":0.31,"r":0.0169,"k":"b"},{"x":0.6854,"y":0.3351,"r":0.0137,"k":"b"},{"x":0.736,"y":0.3351,"r":0.0137,"k":"b"},{"x":0.3946,"y":0.3743,"r":0.0169,"k":"b"},{"x":0.4611,"y":0.3743,"r":0.0169,"k":"b"},{"x":0.4976,"y":0.3783,"r":0.0156,"k":"b"},{"x":0.5789,"y":0.3743,"r":0.0169,"k":"b"},{"x":0.6387,"y":0.3743,"r":0.0169,"k":"b"},{"x":0.306,"y":0.3905,"r":0.0132,"k":"b"},{"x":0.3488,"y":0.3897,"r":0.0125,"k":"m"},{"x":0.6854,"y":0.3913,"r":0.0138,"k":"b"},{"x":0.7361,"y":0.3912,"r":0.0135,"k":"b"},{"x":0.3061,"y":0.4458,"r":0.0132,"k":"b"},{"x":0.3487,"y":0.445,"r":0.0128,"k":"b"},{"x":0.3946,"y":0.4374,"r":0.0169,"k":"b"},{"x":0.4611,"y":0.4477,"r":0.0172,"k":"b"},{"x":0.4976,"y":0.4465,"r":0.0154,"k":"b"},{"x":0.5482,"y":0.4338,"r":0.0104,"k":"m"},{"x":0.5789,"y":0.4374,"r":0.0169,"k":"b"},{"x":0.6387,"y":0.4374,"r":0.0169,"k":"b"},{"x":0.6854,"y":0.4478,"r":0.0138,"k":"b"},{"x":0.7361,"y":0.4471,"r":0.0137,"k":"b"},{"x":0.1651,"y":0.55,"r":0.0175,"k":"b"},{"x":0.2023,"y":0.5499,"r":0.0172,"k":"b"},{"x":0.2388,"y":0.5491,"r":0.0168,"k":"b"},{"x":0.274,"y":0.5489,"r":0.0166,"k":"b"},{"x":0.3088,"y":0.5489,"r":0.0166,"k":"b"},{"x":0.7318,"y":0.5479,"r":0.0172,"k":"b"},{"x":0.7682,"y":0.5481,"r":0.0171,"k":"b"},{"x":0.8068,"y":0.5484,"r":0.0171,"k":"b"},{"x":0.8435,"y":0.5483,"r":0.0169,"k":"b"},{"x":0.879,"y":0.5483,"r":0.0168,"k":"b"},{"x":0.165,"y":0.624,"r":0.0169,"k":"b"},{"x":0.2022,"y":0.6238,"r":0.0168,"k":"b"},{"x":0.2388,"y":0.6238,"r":0.0168,"k":"b"},{"x":0.274,"y":0.6236,"r":0.0166,"k":"b"},{"x":0.309,"y":0.6235,"r":0.0166,"k":"b"},{"x":0.7318,"y":0.6221,"r":0.0169,"k":"b"},{"x":0.7683,"y":0.622,"r":0.0169,"k":"b"},{"x":0.8068,"y":0.6221,"r":0.0169,"k":"b"},{"x":0.8435,"y":0.6221,"r":0.0168,"k":"b"},{"x":0.8789,"y":0.6219,"r":0.0168,"k":"b"},{"x":0.1653,"y":0.6964,"r":0.0169,"k":"b"},{"x":0.2022,"y":0.6965,"r":0.0169,"k":"b"},{"x":0.2387,"y":0.6966,"r":0.0168,"k":"b"},{"x":0.274,"y":0.6965,"r":0.0166,"k":"b"},{"x":0.309,"y":0.6964,"r":0.0166,"k":"b"},{"x":0.7319,"y":0.6964,"r":0.0172,"k":"b"},{"x":0.7683,"y":0.6962,"r":0.0168,"k":"b"},{"x":0.8068,"y":0.6962,"r":0.0169,"k":"b"},{"x":0.8435,"y":0.696,"r":0.0168,"k":"b"},{"x":0.8789,"y":0.696,"r":0.0165,"k":"b"},{"x":0.1653,"y":0.7702,"r":0.0169,"k":"b"},{"x":0.2021,"y":0.7702,"r":0.0168,"k":"b"},{"x":0.2387,"y":0.7703,"r":0.0168,"k":"b"},{"x":0.274,"y":0.7705,"r":0.0166,"k":"b"},{"x":0.309,"y":0.7702,"r":0.0166,"k":"b"},{"x":0.7319,"y":0.7707,"r":0.0171,"k":"b"},{"x":0.7682,"y":0.7706,"r":0.0171,"k":"b"},{"x":0.8068,"y":0.7705,"r":0.0171,"k":"b"},{"x":0.8435,"y":0.7704,"r":0.0169,"k":"b"},{"x":0.879,"y":0.7703,"r":0.0168,"k":"b"}] },
        { id: "local-sufrido", nombre: "El sufrido", tipo: "imagen", imagen: "assets/img/proyectos/el-sufrido.webp", quien: ["xaasw"], conos: [{"x":0.4156,"y":0.1989,"r":0.0407,"k":"b"},{"x":0.5937,"y":0.1989,"r":0.0407,"k":"b"},{"x":0.4156,"y":0.3674,"r":0.0407,"k":"b"},{"x":0.5937,"y":0.3674,"r":0.0407,"k":"b"},{"x":0.3308,"y":0.1978,"r":0.034,"k":"m"},{"x":0.3308,"y":0.3717,"r":0.034,"k":"m"},{"x":0.6828,"y":0.1978,"r":0.034,"k":"m"},{"x":0.6828,"y":0.3717,"r":0.034,"k":"m"},{"x":0.2629,"y":0.2826,"r":0.0144,"k":"t"},{"x":0.3953,"y":0.2826,"r":0.0144,"k":"t"},{"x":0.6107,"y":0.2826,"r":0.0144,"k":"t"},{"x":0.7489,"y":0.2826,"r":0.0144,"k":"t"}] }
    ];
    const locales = () => LOCALES.filter(p => p.quien.indexOf(api.user()) >= 0);
    async function refresh() {
        if (!DB) { inv = locales(); return show(); }
        let x = [];
        try { x = await R("proyectos_mios"); x = Array.isArray(x) ? x : []; } catch (e) { x = inv.filter(p => !p.quien); }
        inv = x.concat(locales().filter(l => !x.some(p => p.id === l.id)));
        try { Object.keys(localStorage).forEach(k => { if (k.indexOf("rdimg:") === 0 && !inv.some(p => "rdimg:" + p.id === k)) localStorage.removeItem(k); }); } catch (e) { }
        show();
    }

    function use(id) {
        st.id = id; sv();
        const p = inv.find(x => x.id === id);
        if (p && p.tipo === "config" && p.config) {
            const c = p.config;
            try {
                if (c.spk) setSpk(c.spk, true);
                if (c.caja) setCase(c.caja, true);
                if (c.color !== "" && c.color != null) setColor(+c.color, false);
                if (Array.isArray(c.stack)) {
                    /* respeta lo que tienes desbloqueado: sin Kitipo solo chucheros de 6 y el bajo de 12 */
                    const ok = typeof kitOK === "function" && kitOK();
                    spkSet(c.stack.filter(n => ok || n === 6), true, true);
                    setBajo(c.bajo && (ok || c.bajo === "12") ? c.bajo : "", true);
                }
                else
                    setSpkSize(6, true);
                tbSet(Array.isArray(c.tabs) ? c.tabs : [], true);
                rowSetOrd(c.row);
                rowSave();
                setDrv(typeof c.drv === "string" && c.drv ? c.drv : null, true);
            } catch (e) { }
        }
        show();
    }
    const quit = () => { st.id = ""; sv(); show(); };

    async function view(note) {
        if (!DB) {
            const c0 = card("prj");
            c0.append(E("div", "ach", "\uD83D\uDDC2"), E("h2", "", "Proyectos"), E("p", "vs", "Los proyectos necesitan la base de datos. Pega RD_DB_URL y RD_DB_KEY en js/config.js y vuelve a publicar la p\u00e1gina."));
            return;
        }
        const c = card("prj"), box = E("div"), nm = api.field("Nombre de tu proyecto", "text", "off", "\u270F\uFE0F"), sub = E("button", "acsub", "Guardar mi personalizaci\u00f3n"), err = E("div", "acerr" + (note ? " ok" : ""), note || "");
        c.append(E("div", "ach", "\uD83D\uDDC2"), E("h2", "", "Proyectos"), E("p", "vs", "Usa un proyecto en lugar del chuchero."), box);
        box.appendChild(E("p", "vs", "Cargando..."));
        const my = gen;
        await refresh();
        if (!adm.ok) await admRefresh();
        if (!alive(my)) return;
        box.textContent = "";
        if (!inv.length) box.appendChild(E("p", "vs", "Todav\u00eda no tienes proyectos. Guarda tu personalizaci\u00f3n abajo."));
        const act = inv.find(x => x.id === st.id && x.tipo === "imagen");
        if (act) {
            const z = E("div", "prz"), rg = E("input"), fx = E("button", "", st.fijo ? "\uD83D\uDCCC Fijado" : "\uD83D\uDD13 Suelto");
            rg.type = "range"; rg.min = 5; rg.max = 90; rg.value = Math.round(st.w * 100);
            rg.oninput = () => { st.w = rg.value / 100; sv(); show(); };
            fx.type = "button";
            fx.onclick = () => { st.fijo = !st.fijo; sv(); show(); fx.textContent = st.fijo ? "\uD83D\uDCCC Fijado" : "\uD83D\uDD13 Suelto"; };
            z.append(E("span", "", "Tama\u00f1o"), rg, fx);
            box.appendChild(z);
        }
        inv.forEach(p => {
            const on = p.id === st.id, r = E("div", "prow" + (on ? " on" : "")), t = p.tipo === "imagen" ? E("img") : E("i", "", "\uD83C\uDFA8"), b = E("button", "", on ? "Quitar" : "Usar");
            if (p.tipo === "imagen") { if (p.imagen) t.src = p.imagen; else imgOf(p).then(v => { if (v) t.src = v; }); }
            b.type = "button";
            b.onclick = () => { on ? quit() : use(p.id); view(); };
            r.append(t, E("span", "", p.nombre + (p.tipo === "config" ? " \u00b7 personalizado" : " \u00b7 privado")), b);
            if (p.propio) {
                const x = E("button", "del", "\uD83D\uDDD1");
                x.type = "button";
                x.onclick = async () => { try { await R("proyecto_borrar", { p_id: p.id }); if (on) quit(); } catch (e) { } view(); };
                r.appendChild(x);
            }
            box.appendChild(r);
        });
        sub.type = "button";
        sub.onclick = async () => {
            const n = nm.i.value.trim();
            if (!n) { err.className = "acerr"; err.textContent = "Ponle un nombre."; return; }
            sub.classList.add("ld");
            try { await R("proyecto_config", { p_nombre: n, p_config: { color: g("pioneerColor"), caja: g("pioneerCase"), spk: g("pioneerSpk2"), stack: spkStack.slice(), bajo: bajoId, tabs: tbStack.map(x => x.slice()), row: rowOrd.slice(), drv: drvCol || "" } }); view("\u2705 Proyecto guardado."); }
            catch (e) { sub.classList.remove("ld"); err.className = "acerr"; err.textContent = msg(e); }
        };
        c.append(E("div", "vh", "GUARDAR MI PROYECTO (CHUCHERO GRATIS)"), nm.w, sub, err);
        if (adm.ok || est.admin) {
            const a = E("button", "acsub adm", "\uD83D\uDEE1 Panel de administrador");
            a.type = "button"; a.onclick = () => admin();
            c.appendChild(a);
        }
    }

    /* Reduce la imagen para la base de datos (m\u00e1x. ~600 KB): empieza grande y baja el tama\u00f1o/calidad solo si hace falta, para que los proyectos grandes no se vean borrosos. */
    const shrink = f => new Promise((res, rej) => {
        const u = URL.createObjectURL(f), im = new Image();
        im.onload = () => {
            URL.revokeObjectURL(u);
            let m = 1600, q = .86, out = "";
            for (let i = 0; i < 8; i++) {
                const k = Math.min(1, m / Math.max(im.width, im.height)), cv = document.createElement("canvas");
                cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
                const cx = cv.getContext("2d");
                cx.imageSmoothingQuality = "high";
                cx.drawImage(im, 0, 0, cv.width, cv.height);
                out = cv.toDataURL("image/webp", q);
                if (out.length <= 600000) break;
                if (q > .7) q -= .08; else m = Math.round(m * .8);
            }
            res(out);
        };
        im.onerror = () => rej(new Error("imagen_invalida"));
        im.src = u;
    });

    /* ===== Panel de administrador: secciones con pesta\u00f1as ===== */
    let adm = { ok: false, dueno: false, yo: "", lista: [] };
    /* ===== PIN de administrador: ser admin no basta, hay que abrir el panel con un PIN (el permiso dura 20 minutos) ===== */
    const est = { admin: false, pin: false, abierto: false };
    async function estadoAdmin() {
        if (!DB || !api.tok()) { est.admin = est.pin = est.abierto = false; return est; }
        try { const r = await R("admin_estado"); est.admin = !!(r && r.admin); est.pin = !!(r && r.pin); est.abierto = !!(r && r.abierto); } catch (e) {
            /* Si aun no ejecutaste SQL-ADMIN-SEGURO.sql, admin_estado no existe: usamos la comprobacion antigua (el servidor sigue decidiendo) */
            est.admin = est.pin = est.abierto = false;
            try { await admRefresh(); if (adm.ok) est.admin = est.pin = est.abierto = true; } catch (e2) { }
        }
        return est;
    }
    function pinPantalla(c, siguiente) {
        const crear = !est.pin, bk = E("button", "acout", "\u2190 Volver"), er = E("div", "acerr"), go = E("button", "acsub", crear ? "Crear PIN y entrar" : "Abrir panel");
        bk.type = "button"; bk.onclick = () => view();
        go.type = "button";
        const f1 = api.field(crear ? "Nuevo PIN de administrador" : "PIN de administrador", "password", "off", "\ud83d\udd10"), i1 = f1.i;
        const f2 = crear ? api.field("Repite el PIN", "password", "off", "\ud83d\udd10") : null, i2 = f2 && f2.i;
        c.append(E("div", "ach", "\ud83d\udee1"), E("h2", "", crear ? "Crea tu PIN de administrador" : "PIN de administrador"),
            E("p", "vs", crear ? "Es una segunda clave solo para el panel (8 a 40 caracteres, con letras y n\u00fameros). El permiso dura 20 minutos y solo en este navegador. Gu\u00e1rdalo bien." : "El permiso de administrador dura 20 minutos en este navegador."), f1.w);
        if (f2) c.appendChild(f2.w);
        c.append(er, go, bk);
        const hacer = async () => {
            er.textContent = "";
            const pin = i1.value;
            if (crear && pin !== i2.value) { er.textContent = "Los dos PIN no coinciden."; return; }
            go.classList.add("ld");
            try {
                const r = crear ? await R("admin_pin_crear", { p_pin: pin }) : await R("admin_abrir", { p_pin: pin });
                if (r && r.error) { er.textContent = msg(new Error(r.error)) + (r.quedan != null ? " Te quedan " + r.quedan + " intentos." : ""); i1.value = ""; go.classList.remove("ld"); return; }
                est.pin = true; est.abierto = true;
                await hyRefresh();
                try { hb.style.display = DB && hy.ok ? "" : "none"; } catch (e) { }
                siguiente();
            } catch (e) { er.textContent = msg(e); go.classList.remove("ld"); }
        };
        go.onclick = hacer;
        [i1, i2].forEach(i => i && i.addEventListener("keydown", e => { if (e.key === "Enter") hacer(); }));
        setTimeout(() => i1.focus({ preventScroll: true }), 60);
    }
    async function admRefresh() {
        const nada = { ok: false, dueno: false, yo: "", lista: [] };
        if (!DB || !api.tok()) { adm = nada; return; }
        try {
            const r = await R("admin_lista");
            adm = r && typeof r === "object" && r.yo ? { ok: true, dueno: r.dueno === true, yo: r.yo, lista: Array.isArray(r.admins) ? r.admins : [] } : nada;
        } catch (e) { adm = nada; }
    }

    const TABS = [["proy", "\ud83d\udcc1", "Proyectos"], ["cuen", "\ud83d\udc64", "Cuentas"], ["cod", "\ud83d\udd11", "C\u00f3digos"], ["adm", "\ud83d\udee1", "Admins"], ["ayu", "\ud83e\udd1d", "Ayudantes"], ["mon", "\ud83e\ude99", "Monedas"]];

    async function admin(note, tab) {
        tab = tab || "proy";
        const c = card("prj gsp"), my = gen, hd = E("div", "gshd"), tabs = E("div", "gstb"), ind = E("i", "gsix"), pane = E("div", "gspn"), toast = E("div", "gsts"), bk = E("button", "acout", "\u2190 Volver");
        bk.type = "button"; bk.onclick = () => view();
        if (!adm.ok) {
            await estadoAdmin();
            if (my !== gen) return;
            if (est.admin && (!est.pin || !est.abierto)) return pinPantalla(c, () => admin(note, tab));
            await admRefresh();
        }
        if (my !== gen) return;
        if (!adm.ok) { c.append(E("div", "ach", "\ud83d\udee1"), E("h2", "", "Administrador"), E("p", "vs", "Tu cuenta no tiene permiso de administrador."), bk); return; }
        hd.append(E("div", "gsic", "\ud83d\udee1"), E("div", "gstt", ""));
        hd.lastChild.append(E("h2", "", "Panel de administrador"), E("p", "", "Sesi\u00f3n: " + adm.yo + " \u00b7 " + (adm.dueno ? "Propietario" : "Administrador")));
        const say = (t, ok) => { toast.className = "gsts show" + (ok ? " ok" : " bad"); toast.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove("show"), 6000); };
        if (note) say(note, true);
        const sec = (t, d) => { const s = E("div", "gssc"); s.style.setProperty("--i", pane.children.length); s.append(E("h3", "", t)); if (d) s.append(E("p", "", d)); pane.appendChild(s); return s; };
        const busy = (b, f) => async () => { b.classList.add("ld"); try { await f(); } catch (e) { say(msg(e), false); } b.classList.remove("ld"); };

        const draw = id => {
            tab = id;
            tabs.style.setProperty("--n", TABS.findIndex(t => t[0] === id));
            tabs.style.setProperty("--nt", TABS.length);
            [...tabs.querySelectorAll("button")].forEach(b => b.classList.toggle("on", b.dataset.t === id));
            pane.textContent = "";
            pane.classList.remove("gsin"); void pane.offsetWidth; pane.classList.add("gsin");
            /* Si una sección falla, se muestra el motivo en pantalla en vez de dejarla vac\u00eda. */
            try {
                ({ proy: pProy, cuen: pCuen, cod: pCod, adm: pAdm, ayu: pAyu, mon: pMon })[id]();
                if (!pane.children.length) throw new Error("secci\u00f3n sin contenido");
            } catch (e) {
                pane.textContent = "";
                const f = sec("No se pudo mostrar esta secci\u00f3n", "Toca otra pesta\u00f1a o recarga la p\u00e1gina con Ctrl+F5. Si sigue igual, mu\u00e9strale este mensaje a quien te ayuda:");
                f.append(E("p", "gsnt", String(e && e.message || e)));
            }
        };

        /* --- Proyectos --- */
        const pProy = () => {
            const s1 = sec("Crear proyecto privado", "Sube la imagen: queda en tu inventario y luego marcas sus bocinas."), nm = api.field("Nombre del proyecto", "text", "off", "\u270f\ufe0f"), fi = E("input", "prfi"), cr = E("button", "acsub", "Crear proyecto");
            fi.type = "file"; fi.accept = "image/*"; cr.type = "button";
            s1.append(nm.w, fi, cr);
            cr.onclick = async () => {
                if (!nm.i.value.trim() || !fi.files[0]) return say("Pon un nombre y elige una imagen.", false);
                cr.classList.add("ld");
                const my2 = gen;
                try {
                    const im = await shrink(fi.files[0]), n = await R("admin_crear", { p_nombre: nm.i.value.trim(), p_imagen: im });
                    let cs = []; try { cs = await detectar(im); if (cs.length) await R("admin_conos", { p_proyecto: n.id, p_conos: cs }); } catch (e) { }
                    await refresh();
                    if (my2 === gen) marcar(n.id);
                } catch (e) { cr.classList.remove("ld"); say(msg(e), false); }
            };
            const s2 = sec("Proyectos existentes", "Elige uno para darlo a un usuario o marcar sus bocinas."), sel = E("select", "prsel"), us = api.field("Usuario que lo recibe", "text", "off", "\ud83d\udc64"), as = E("button", "acsub", "A\u00f1adir al inventario"), mk = E("button", "acout ghost", "\ud83d\udd0a Marcar bocinas");
            as.type = mk.type = "button";
            s2.append(sel, us.w, as, mk);
            R("admin_listar").then(l => { (l || []).forEach(p => { const o = E("option", "", p.nombre); o.value = p.id; sel.appendChild(o); }); if (!sel.options.length) sel.appendChild(E("option", "", "Todav\u00eda no hay proyectos")); }).catch(e => say(msg(e), false));
            mk.onclick = () => { if (sel.value) marcar(sel.value); else say("Elige un proyecto.", false); };
            as.onclick = busy(as, async () => {
                const u = us.i.value.trim().toLowerCase();
                if (!sel.value || !u) return say("Elige un proyecto y escribe el usuario.", false);
                await R("admin_asignar", { p_proyecto: sel.value, p_usuario: u });
                us.i.value = ""; say("A\u00f1adido al inventario de " + u + ".", true);
            });
        };

        /* --- Cuentas --- */
        const pCuen = () => {
            const s = sec("Restablecer contrase\u00f1a", "Si alguien no puede entrar, ponle una contrase\u00f1a nueva. Tambi\u00e9n quita bloqueos y cierra sus sesiones."), rk = api.field("Usuario", "text", "off", "\ud83d\udc64"), rp = api.field("Contrase\u00f1a nueva (8 a 40)", "text", "off", "\ud83d\udd11"), rb = E("button", "acsub", "Restablecer contrase\u00f1a");
            rb.type = "button";
            s.append(rk.w, rp.w, rb);
            rb.onclick = busy(rb, async () => {
                const u = rk.i.value.trim().toLowerCase(), k = rp.i.value;
                if (!u || k.length < 8) return say("Escribe el usuario y una contrase\u00f1a de al menos 8 caracteres.", false);
                const r = await R("admin_clave", { p_usuario: u, p_clave: k });
                if (r && r.ok) { rp.i.value = ""; say("Contrase\u00f1a de " + u + " restablecida. D\u00e1sela por un medio privado.", true); }
                else say("Ese usuario no existe en el servidor.", false);
            });
        };

        /* --- C\u00f3digos --- */
        const pCod = () => {
            const s = sec("Generar c\u00f3digos de un solo uso", "Cada c\u00f3digo se desbloquea una vez, en una sola cuenta."), tp = E("select", "prsel"), n = E("input", "prsel"), nt = E("input", "prsel"), go = E("button", "acsub", "Generar c\u00f3digos");
            [["vip", "\u2b50 Personalizaci\u00f3n"], ["kit", "\ud83d\udd0a Kitipo y Bajos"], ["cro", "\ud83c\udf9b\ufe0f Crossover y Procesador"]].forEach(([v, t]) => { const o = E("option", "", t); o.value = v; tp.appendChild(o); });
            n.type = "number"; n.min = 1; n.max = 50; n.value = 1; n.placeholder = "Cantidad";
            nt.type = "text"; nt.maxLength = 60; nt.placeholder = "Nota (para qui\u00e9n es, opcional)";
            go.type = "button";
            s.append(tp, n, nt, go);
            const s2 = sec("\u00daltimos c\u00f3digos"), box = E("div", "pcod");
            s2.appendChild(box);
            const copy = (t, b) => { try { navigator.clipboard.writeText(t); b.textContent = "Copiado"; } catch (e) { } };
            const list = async () => {
                box.textContent = "";
                try {
                    const l = (await R("admin_codigos")) || [];
                    if (!l.length) box.appendChild(E("p", "vs", "Todav\u00eda no hay c\u00f3digos."));
                    l.forEach((x, i) => {
                        const r = E("div", "prow" + (x.usado ? "" : " on")), b = E("button", "", "Copiar"), f = vfmt(x.codigo);
                        r.style.setProperty("--i", Math.min(i, 12));
                        b.type = "button"; b.onclick = () => copy(f, b);
                        r.append(E("span", "", f + " \u00b7 " + (x.tipo === "vip" ? "Personalizaci\u00f3n" : x.tipo === "cro" ? "Crossover" : "Kitipo") + (x.nota ? " \u00b7 " + x.nota : "") + (x.usado ? " \u00b7 usado por " + x.usado : " \u00b7 disponible")), b);
                        box.appendChild(r);
                    });
                } catch (e) { say(msg(e), false); }
            };
            go.onclick = busy(go, async () => {
                const q = Math.min(50, Math.max(1, parseInt(n.value) || 1));
                const r = await R("admin_generar", { p_tipo: tp.value, p_cantidad: q, p_nota: nt.value.trim() || null }), all = (r.codigos || []).map(vfmt);
                say(all.length + " c\u00f3digo(s) creado(s): " + all.join("  "), true);
                if (all.length > 1) { try { navigator.clipboard.writeText(all.join("\n")); say(all.length + " c\u00f3digos creados y copiados al portapapeles.", true); } catch (e) { } }
                list();
            });
            list();
        };

        /* --- Administradores --- */
        const pAdm = () => {
            const s = sec("Administradores actuales", adm.dueno ? "Puedes quitar a cualquiera menos a ricky." : "Solo la cuenta ricky puede a\u00f1adir o quitar administradores.");
            const box = E("div", "pcod"); s.appendChild(box);
            adm.lista.forEach((a, i) => {
                const r = E("div", "prow gsr"), who = E("span", "", a.usuario + (a.usuario === "ricky" ? " \u00b7 Propietario" : a.por ? " \u00b7 a\u00f1adido por " + a.por : ""));
                r.style.setProperty("--i", i);
                r.append(E("i", "", a.usuario === "ricky" ? "\ud83d\udc51" : "\ud83d\udee1"), who);
                if (adm.dueno && a.usuario !== "ricky") {
                    const x = E("button", "del", "Quitar");
                    x.type = "button";
                    x.onclick = busy(x, async () => { await R("admin_quitar", { p_usuario: a.usuario }); await admRefresh(); say(a.usuario + " ya no es administrador.", true); draw("adm"); });
                    r.appendChild(x);
                }
                box.appendChild(r);
            });
            if (adm.dueno) {
                const s2 = sec("A\u00f1adir un administrador", "La cuenta ya tiene que estar creada. Tendr\u00e1 acceso a este panel (proyectos, c\u00f3digos y contrase\u00f1as)."), un = api.field("Usuario", "text", "off", "\ud83d\udc64"), ab2 = E("button", "acsub", "A\u00f1adir administrador");
                ab2.type = "button";
                s2.append(un.w, ab2);
                ab2.onclick = busy(ab2, async () => {
                    const u = un.i.value.trim().toLowerCase();
                    if (!u) return say("Escribe el usuario.", false);
                    const r = await R("admin_agregar", { p_usuario: u });
                    if (r && r.ok) { await admRefresh(); say(u + " ahora es administrador.", true); draw("adm"); }
                    else say("Ese usuario no existe. P\u00eddele que cree su cuenta primero.", false);
                });
            } else {
                const s3 = sec("Permisos"); s3.append(E("p", "gsnt", "\ud83d\udd12 A\u00f1adir o quitar administradores es solo del propietario (ricky)."));
            }
        };

        /* --- Ayudantes (los administra el panel de administrador) --- */
        /* ===== Monedas: entregar monedas, historial y precios de las baterías ===== */
        const pMon = () => {
            const s = sec("Entregar monedas", "Busca la cuenta, escribe la cantidad y confirma. Cada entrega queda registrada con tu nombre, la fecha y el motivo."),
                q = api.field("Buscar usuario o nombre", "text", "off", "\ud83d\udd0e"), lista = E("div", "pcod"), sel = E("div", "prow gsr"),
                cant = api.field("Cantidad de monedas", "number", "off", "\ud83e\ude99"), mot = api.field("Motivo (opcional)", "text", "off", "\ud83d\udcdd"), go = E("button", "acbtn", "Revisar entrega"), res = E("p", "gsnt", "");
            go.type = "button"; cant.i.min = 1; cant.i.step = 1; mot.i.maxLength = 120;
            s.append(q.w, lista, sel, cant.w, mot.w, go, res);
            let elegido = null, req = null, paso = 0, t = 0;
            sel.style.display = "none";
            const buscar = async () => {
                const r = (await R("admin_monedas_buscar", { p_q: q.i.value })) || [];
                lista.textContent = "";
                r.forEach(u => {
                    const f = E("div", "prow gsr"), b = E("button", "del", "Elegir");
                    b.type = "button";
                    f.append(E("i", "", "\ud83d\udc64"), E("span", "", u.usuario + " \u00b7 " + u.nombre + " \u00b7 saldo " + u.monedas), b);
                    b.onclick = () => { elegido = u; paso = 0; req = null; sel.style.display = ""; sel.textContent = ""; sel.append(E("i", "", "\u2705"), E("span", "", "Cuenta elegida: " + u.usuario + " (saldo " + u.monedas + ")")); go.textContent = "Revisar entrega"; res.textContent = ""; };
                    f.appendChild(b); lista.appendChild(f);
                });
                if (!r.length) lista.appendChild(E("p", "gsnt", "No se encontr\u00f3 ninguna cuenta."));
            };
            q.i.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => buscar().catch(e => say(msg(e), false)), 350); });
            buscar().catch(() => { });
            [cant.i, mot.i].forEach(i => i.addEventListener("input", () => { paso = 0; req = null; go.textContent = "Revisar entrega"; }));
            go.onclick = busy(go, async () => {
                const n = parseInt(cant.i.value, 10);
                if (!elegido) return say("Primero elige una cuenta.", false);
                if (!(n >= 1) || String(n) !== String(cant.i.value).trim()) return say("Escribe una cantidad entera mayor que 0.", false);
                if (paso === 0) { paso = 1; req = "adm" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); res.textContent = "Resumen: dar " + n + " monedas a " + elegido.usuario + (mot.i.value.trim() ? " \u00b7 motivo: " + mot.i.value.trim() : "") + ". Pulsa de nuevo para confirmar."; go.textContent = "Confirmar entrega de " + n; return; }
                const r = await R("admin_monedas_dar", { p_usuario: elegido.usuario, p_cantidad: n, p_motivo: mot.i.value.trim(), p_req: req });
                say(r && r.repetido ? "Esa entrega ya estaba registrada (no se duplic\u00f3)." : "Listo: " + elegido.usuario + " ahora tiene " + r.saldo + " monedas.", true);
                draw("mon");
            });
            const h = sec("Historial de monedas entregadas"), hl = E("div", "pcod"); h.appendChild(hl);
            R("admin_monedas_historial").then(l => {
                (l || []).forEach(x => { const f = E("div", "prow gsr"); f.append(E("i", "", "\ud83e\ude99"), E("span", "", new Date(x.creado).toLocaleString() + " \u00b7 " + x.admin + " \u2192 " + x.usuario + " \u00b7 +" + x.monto + (x.detalle ? " \u00b7 " + x.detalle : ""))); hl.appendChild(f); });
                if (!(l || []).length) hl.appendChild(E("p", "gsnt", "A\u00fan no se han entregado monedas."));
            }).catch(e => say(msg(e), false));
            const pr = sec("Precios y tiempos de recarga de las bater\u00edas", "Los cambios aplican a las pr\u00f3ximas compras y recargas."), pl = E("div", "pcod"); pr.appendChild(pl);
            R("admin_bat_catalogo").then(l => (l || []).forEach(c => {
                const f = E("div", "prow gsr"), p1 = E("input"), p2 = E("input"), ok = E("button", "del", "Guardar");
                p1.type = p2.type = "number"; p1.value = c.precio; p2.value = c.recarga_s; p1.title = "Precio en monedas"; p2.title = "Segundos de recarga completa"; p1.style.width = p2.style.width = "78px"; ok.type = "button";
                ok.onclick = busy(ok, async () => { await R("admin_bat_ajustar", { p_tipo: c.tipo, p_precio: parseInt(p1.value, 10), p_recarga_s: parseInt(p2.value, 10), p_activo: true }); say(c.nombre + ": guardado.", true); });
                f.append(E("span", "", c.nombre + " \u00b7 precio / recarga (s)"), p1, p2, ok); pl.appendChild(f);
            })).catch(e => say(msg(e), false));
        };

        const pAyu = () => {
            const s = sec("Ayudantes actuales", "Un ayudante NO es administrador: solo puede verificar cuentas, restablecer contrase\u00f1as de cuentas normales y consultar pagos.");
            const box = E("div", "pcod");
            s.appendChild(box);
            const load = async () => {
                box.textContent = "";
                box.appendChild(E("p", "gsnt", "Cargando..."));
                let l = [];
                try { l = (await R("admin_ayudantes")) || []; } catch (e) { box.textContent = ""; box.appendChild(E("p", "gsnt", /PGRST202|schema cache/i.test(String(e && e.message)) ? "Falta correr SQL-AYUDANTES.sql en Supabase." : msg(e))); return; }
                box.textContent = "";
                if (!l.length) box.appendChild(E("p", "gsnt", "Todav\u00eda no hay ayudantes."));
                l.forEach((a, i) => {
                    const r = E("div", "prow gsr"), x = E("button", "del", "Quitar");
                    r.style.setProperty("--i", i);
                    x.type = "button";
                    x.onclick = busy(x, async () => { await R("admin_ayudante_quitar", { p_usuario: a.usuario }); say(a.usuario + " ya no es ayudante.", true); load(); });
                    r.append(E("i", "", "\ud83e\udd1d"), E("span", "", a.usuario + (a.por ? " \u00b7 a\u00f1adido por " + a.por : "")), x);
                    box.appendChild(r);
                });
            };
            load();
            const s2 = sec("A\u00f1adir un ayudante", "La cuenta ya tiene que estar creada."), un = api.field("Usuario", "text", "off", "\ud83d\udc64"), ab = E("button", "acsub", "A\u00f1adir ayudante");
            ab.type = "button";
            s2.append(un.w, ab);
            ab.onclick = busy(ab, async () => {
                const u = un.i.value.trim().toLowerCase();
                if (!u) return say("Escribe el usuario.", false);
                const r = await R("admin_ayudante_agregar", { p_usuario: u });
                if (r && r.ok) { un.i.value = ""; say(u + " ahora es ayudante.", true); load(); }
                else say(r && r.error === "ya_es_admin" ? "Esa cuenta ya es administradora." : "Ese usuario no existe. P\u00eddele que cree su cuenta primero.", false);
            });
            const s3 = sec("Movimientos de los ayudantes", "Los \u00faltimos cambios de contrase\u00f1a hechos por ayudantes."), lg = E("div", "pcod"), lb = E("button", "acsub", "Ver movimientos");
            lb.type = "button";
            s3.append(lb, lg);
            lb.onclick = busy(lb, async () => {
                lg.textContent = "";
                const l = (await R("admin_ayuda_log")) || [];
                if (!l.length) lg.appendChild(E("p", "gsnt", "Sin movimientos."));
                l.forEach((a, i) => { const r = E("div", "prow gsr"); r.style.setProperty("--i", i); r.append(E("i", "", "\ud83d\udd11"), E("span", "", a.quien + " cambi\u00f3 la contrase\u00f1a de " + a.objetivo + " \u00b7 " + new Date(a.ts).toLocaleString())); lg.appendChild(r); });
            });
        };

        TABS.forEach(([id, ic, tx]) => { const b = E("button", "", ic + " " + tx); b.type = "button"; b.dataset.t = id; b.onclick = () => draw(id); tabs.appendChild(b); });
        tabs.appendChild(ind);
        c.append(hd, tabs, pane, toast, bk);
        draw(tab);
    }

    /* ===== Panel de ayudantes: menos poderes que el administrador ===== */
    let hy = { ok: false, admin: false, yo: "" };
    async function hyRefresh() {
        hy = { ok: false, admin: false, yo: "" };
        if (!DB || !api.tok()) return;
        try { const r = await R("ayuda_yo"); if (r && r.yo) hy = { ok: true, admin: r.admin === true, yo: r.yo }; } catch (e) { }
    }
    const HERR = { sin_permiso: "Solo un administrador puede cambiar la contrase\u00f1a de administradores o ayudantes.", datos_invalidos: "Revisa los datos: la contrase\u00f1a debe tener entre 8 y 40 caracteres." };
    const hmsg = e => HERR[String(e && e.message || "")] || (/PGRST202|schema cache/i.test(String(e && e.message)) ? "Falta correr SQL-AYUDANTES.sql en Supabase." : msg(e));
    async function ayuda(note, tab) {
        tab = tab || "cue";
        const c = card("prj gsp"), my = gen, hd = E("div", "gshd"), tabs = E("div", "gstb"), ind = E("i", "gsix"), pane = E("div", "gspn"), toast = E("div", "gsts"), bk = E("button", "acout", "\u2190 Volver");
        bk.type = "button"; bk.onclick = () => view();
        if (!hy.ok) await hyRefresh();
        if (my !== gen) return;
        if (!hy.ok) { c.append(E("div", "ach", "\ud83e\udd1d"), E("h2", "", "Ayudantes"), E("p", "vs", "Tu cuenta no es ayudante."), bk); return; }
        const TB = [["cue", "\ud83d\udd0e", "Verificar cuenta"], ["cla", "\ud83d\udd11", "Contrase\u00f1a"], ["pag", "\ud83d\udcb3", "Pagos"]];
        hd.append(E("div", "gsic", "\ud83e\udd1d"), E("div", "gstt", ""));
        hd.lastChild.append(E("h2", "", "Panel de ayudantes"), E("p", "", "Sesi\u00f3n: " + hy.yo + " \u00b7 " + (hy.admin ? "Administrador" : "Ayudante")));
        const say = (t, ok) => { toast.className = "gsts show" + (ok ? " ok" : " bad"); toast.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove("show"), 6000); };
        if (note) say(note, true);
        const sec = (t, d) => { const s = E("div", "gssc"); s.style.setProperty("--i", pane.children.length); s.append(E("h3", "", t)); if (d) s.append(E("p", "", d)); pane.appendChild(s); return s; };
        const busy = (b, f) => async () => { b.classList.add("ld"); try { await f(); } catch (e) { say(hmsg(e), false); } b.classList.remove("ld"); };
        const yn = v => v ? "\u2705 S\u00ed" : "\u2014";
        const pCue = () => {
            const s = sec("Verificar que una cuenta fue creada", "Escribe el usuario y mira si existe y qu\u00e9 pases tiene."), u = api.field("Usuario", "text", "off", "\ud83d\udc64"), b = E("button", "acsub", "Buscar cuenta"), out = E("div", "pcod");
            b.type = "button";
            s.append(u.w, b, out);
            const go = busy(b, async () => {
                const n = u.i.value.trim().toLowerCase();
                out.textContent = "";
                if (!n) return say("Escribe el usuario.", false);
                const r = await R("ayuda_buscar", { p_usuario: n });
                if (!r || !r.existe) { out.appendChild(E("p", "gsnt", "\u274c Esa cuenta NO existe en el servidor.")); return; }
                [["Usuario", r.usuario + (r.rol !== "usuario" ? " (" + r.rol + ")" : "")], ["Creada", new Date(r.creada).toLocaleString()], ["Personalizaci\u00f3n", yn(r.vip)], ["Kitipo y Bajos", yn(r.kit)], ["Crossover y Procesador", yn(r.cro)]].forEach(([k, v], i) => {
                    const row = E("div", "prow gsr");
                    row.style.setProperty("--i", i);
                    row.append(E("span", "", k), E("b", "", v));
                    out.appendChild(row);
                });
                say("\u2705 La cuenta existe.", true);
            });
            b.onclick = go;
            u.i.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        };
        const pCla = () => {
            const s = sec("Restablecer contrase\u00f1a", "Si alguien no puede entrar, ponle una contrase\u00f1a nueva (8 a 40 caracteres). Se cierran sus sesiones. D\u00e1sela por un medio privado."), u = api.field("Usuario", "text", "off", "\ud83d\udc64"), k = api.field("Contrase\u00f1a nueva", "text", "off", "\ud83d\udd11"), b = E("button", "acsub", "Restablecer contrase\u00f1a");
            b.type = "button";
            s.append(u.w, k.w, b);
            b.onclick = busy(b, async () => {
                const n = u.i.value.trim().toLowerCase(), p = k.i.value;
                if (!n || p.length < 8) return say("Escribe el usuario y una contrase\u00f1a de al menos 8 caracteres.", false);
                const r = await R("ayuda_clave", { p_usuario: n, p_clave: p });
                if (r && r.ok) { k.i.value = ""; say("Contrase\u00f1a de " + n + " restablecida.", true); }
                else say("Ese usuario no existe en el servidor.", false);
            });
            s.appendChild(E("p", "gsnt", "\ud83d\udd12 Los ayudantes no pueden cambiar la contrase\u00f1a de administradores ni de otros ayudantes."));
        };
        const pPag = () => {
            const s = sec("Consultar un pago", "Escribe el n\u00famero de orden de PayPal que te da el usuario en su ticket."), o = api.field("N\u00famero de orden", "text", "off", "\ud83e\uddfe"), b = E("button", "acsub", "Buscar pago"), out = E("div", "pcod");
            b.type = "button";
            s.append(o.w, b, out);
            b.onclick = busy(b, async () => {
                out.textContent = "";
                const n = o.i.value.trim();
                if (n.length < 5) return say("Escribe el n\u00famero de orden completo.", false);
                const r = await R("ayuda_pago", { p_orden: n });
                if (!r || !r.existe) { out.appendChild(E("p", "gsnt", "\u274c No hay ning\u00fan pago registrado con esa orden.")); return; }
                const NM = { vip: "Personalizaci\u00f3n", kit: "Kitipo y Bajos", cro: "Crossover y Procesador" };
                [["Pase", NM[r.tipo] || r.tipo], ["Cuenta", r.usuario || "sin cuenta a\u00fan"], ["C\u00f3digo", r.codigo ? vfmt(r.codigo) : "\u2014"]].forEach(([k, v], i) => { const row = E("div", "prow gsr"); row.style.setProperty("--i", i); row.append(E("span", "", k), E("b", "", v)); out.appendChild(row); });
                say("\u2705 Pago encontrado.", true);
            });
        };
        const draw = id => {
            tab = id;
            tabs.style.setProperty("--n", TB.findIndex(t => t[0] === id));
            tabs.style.setProperty("--nt", TB.length);
            [...tabs.querySelectorAll("button")].forEach(b => b.classList.toggle("on", b.dataset.t === id));
            pane.textContent = "";
            pane.classList.remove("gsin"); void pane.offsetWidth; pane.classList.add("gsin");
            try { ({ cue: pCue, cla: pCla, pag: pPag })[id](); }
            catch (e) { pane.textContent = ""; sec("No se pudo mostrar esta secci\u00f3n", "Toca otra pesta\u00f1a o recarga la p\u00e1gina.").append(E("p", "gsnt", String(e && e.message || e))); }
        };
        TB.forEach(([id, ic, tx]) => { const b = E("button", "", ic + " " + tx); b.type = "button"; b.dataset.t = id; b.onclick = () => draw(id); tabs.appendChild(b); });
        tabs.appendChild(ind);
        c.append(hd, tabs, pane, toast, bk);
        draw(tab);
    }

    const b = E("button", "prjb", "\uD83D\uDDC2 Proyectos");
    b.type = "button"; b.style.display = "none"; b.onclick = () => view();
    const ab = E("button", "prjb adm", "\uD83D\uDEE1 Admin"), bar = E("div");
    ab.type = "button"; ab.style.display = "none"; ab.onclick = () => admin();
    bar.id = "prjbar";
    const hb = E("button", "prjb adm", "\ud83e\udd1d Ayudantes");
    hb.type = "button"; hb.style.display = "none"; hb.onclick = () => ayuda();
    bar.append(b, ab, hb);
    document.body.appendChild(bar);
    setInterval(() => {
        const u = api.user();
        if (u === last) return;
        last = u;
        b.style.display = u ? "" : "none";
        ab.style.display = "none";
        hb.style.display = "none";
        adm = { ok: false, dueno: false, yo: "", lista: [] };
        hy = { ok: false, admin: false, yo: "" };
        if (u) { estadoAdmin().then(() => { ab.style.display = DB && est.admin ? "" : "none"; if (est.abierto) admRefresh(); }); hyRefresh().then(() => { hb.style.display = DB && hy.ok ? "" : "none"; }); refresh(); } else { inv = []; show(); }
    }, 1200);
})();

;
/**
 * Equipos: cada usuario puede crear un equipo con nombre y logo, a\u00f1adir gente escribiendo su usuario,
 * y el logo del equipo aparece en la cuenta de cada integrante (junto a su nombre).
 * Todo vive en la base de datos (SQL-EQUIPOS.sql). El logo se guarda a 128 px para gastar poco disco.
 */

(() => {
    const api = window.rdApi;
    if (!api) return;
    const E = mkEl, DB = () => api.REM();
    let team = null, missing = false, sig = "", busy = false;

    const ck = u => "rdteam:" + u;
    const rdC = u => { try { return JSON.parse(localStorage.getItem(ck(u)) || "null"); } catch (e) { return null; } };
    const wrC = (u, t) => { try { if (t) localStorage.setItem(ck(u), JSON.stringify(t)); else localStorage.removeItem(ck(u)); } catch (e) { } };
    const R = (fn, a) => api.rpc(fn, Object.assign({ p_token: api.tok() }, a || {}));

    const ERR = {
        ya_en_equipo: "Ya perteneces a un equipo. Sal de \u00e9l para crear otro.",
        nombre_en_uso: "Ese nombre de equipo ya existe. Elige otro.",
        no_existe: "Ese usuario no existe.",
        otro_equipo: "Esa persona ya est\u00e1 en otro equipo.",
        equipo_lleno: "El equipo est\u00e1 lleno (m\u00e1ximo 20 integrantes).",
        solo_dueno: "Solo el due\u00f1o del equipo puede hacer esto.",
        datos_invalidos: "Revisa los datos: el nombre debe tener entre 2 y 24 letras y el logo debe ser una imagen."
    };
    const msg = e => {
        const m = String(e && e.message || "");
        if (ERR[m]) return ERR[m];
        if (/PGRST202|equipo_|could not find|schema cache/i.test(m)) return "Los equipos todav\u00eda no est\u00e1n activados en la base de datos (falta correr SQL-EQUIPOS.sql).";
        return api.err(e);
    };
    const isMissing = e => /PGRST202|could not find the function|schema cache/i.test(String(e && e.message || ""));

    /* Carga el equipo del usuario actual (primero la copia guardada, luego el servidor). */
    function load() {
        const u = api.user();
        if (!u) { team = null; return; }
        if (!DB() || !api.tok()) { team = rdC(u); api.paint && api.paint(); return; }
        if (busy) return;
        busy = true;
        R("equipo_mio").then(r => {
            if (api.user() !== u) return;
            missing = false;
            team = r && typeof r === "object" ? r : null;
            wrC(u, team);
            api.paint && api.paint();
        }).catch(e => { if (isMissing(e)) missing = true; }).then(() => { busy = false; });
    }

    /* Detecta inicio/cierre de sesi\u00f3n sin tocar cuenta.js */
    setInterval(() => {
        const s = (api.user() || "") + "|" + (api.tok() || "");
        if (s === sig) return;
        sig = s;
        team = api.user() ? rdC(api.user()) : null;
        api.paint && api.paint();
        load();
    }, 3000);
    setInterval(load, 600000);

    /* Recorta al centro, reduce a 128x128 y comprime. */
    function proc(file) {
        return new Promise((ok, no) => {
            const url = URL.createObjectURL(file), im = new Image();
            im.onload = () => {
                try {
                    const S = 128, cv = document.createElement("canvas"), x = cv.getContext("2d"), s = Math.min(im.width, im.height);
                    cv.width = cv.height = S;
                    x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, S, S);
                    let d = cv.toDataURL("image/webp", .85);
                    if (d.indexOf("data:image/webp") !== 0) d = cv.toDataURL("image/jpeg", .85);
                    if (d.length > 58000) d = cv.toDataURL("image/jpeg", .7);
                    if (d.length > 58000) d = cv.toDataURL("image/jpeg", .5);
                    URL.revokeObjectURL(url);
                    d.length > 58000 ? no(new Error("datos_invalidos")) : ok(d);
                } catch (e) { no(e); }
            };
            im.onerror = () => { URL.revokeObjectURL(url); no(new Error("datos_invalidos")); };
            im.src = url;
        });
    }

    /* Selector de logo con vista previa. get() -> undefined (sin cambios) | "" (quitar) | dataURL */
    function picker(cur) {
        const w = E("div", "tmpk"), pv = E("div", "tmpv"), f = E("input"), b = E("button", "tmbtn", "Elegir logo"), r = E("button", "tmbtn", "Quitar");
        let val;
        f.type = "file"; f.accept = "image/*"; f.style.display = "none";
        b.type = r.type = "button";
        const draw = () => {
            const s = val === undefined ? cur : val;
            pv.textContent = "";
            if (s) { const i = E("img"); i.src = s; i.alt = ""; pv.appendChild(i); } else pv.textContent = "\ud83d\udee1";
            r.style.display = s ? "" : "none";
        };
        b.onclick = () => f.click();
        r.onclick = () => { val = ""; draw(); };
        f.onchange = async () => {
            if (!f.files[0]) return;
            try { val = await proc(f.files[0]); draw(); } catch (e) { w.dispatchEvent(new CustomEvent("tmerr", { detail: "No se pudo usar esa imagen." })); }
            f.value = "";
        };
        w.append(pv, E("div", "tmbs"), f);
        w.children[1].append(b, r);
        draw();
        return { w, get: () => val };
    }

    function done(r, u) {
        team = r && typeof r === "object" ? r : null;
        wrC(u, team);
        api.paint && api.paint();
    }

    function head(c, t) {
        const h = E("div", "tmh"), lg = E("div", "tmpv");
        if (t.logo) { const i = E("img"); i.src = t.logo; i.alt = ""; lg.appendChild(i); } else lg.textContent = "\ud83d\udee1";
        h.append(lg, E("h2", "", t.nombre));
        c.appendChild(h);
    }

    function view() {
        const c = api.card("eq"), u = api.user();
        if (!u) return api.login();
        if (!DB() || !api.tok()) {
            c.append(E("div", "ach", "\ud83d\udc65"), E("h2", "", "Equipos"), E("p", "vs", "Los equipos necesitan la cuenta en l\u00ednea. Cierra sesi\u00f3n y entra de nuevo con internet."));
            return;
        }
        const err = E("div", "acerr"), say = t => { err.textContent = t || ""; };
        const run = async (btn, fn) => {
            say(""); btn.classList.add("ld"); btn.disabled = true;
            try { await fn(); } catch (e) { say(msg(e)); if (isMissing(e)) missing = true; }
            btn.classList.remove("ld"); btn.disabled = false;
        };

        if (!team) {
            c.append(E("div", "ach", "\ud83d\udc65"), E("h2", "", "Crear un equipo"), E("p", "vs", "Ponle nombre y logo. Despu\u00e9s a\u00f1ades a tus amigos escribiendo su usuario y el logo del equipo les aparece a todos."));
            const n = api.field("Nombre del equipo", "text", "off", "\ud83c\udff7"), pk = picker("");
            n.i.maxLength = 24;
            pk.w.addEventListener("tmerr", e => say(e.detail));
            const go = E("button", "acsub", "Crear equipo");
            go.type = "button";
            go.onclick = () => run(go, async () => {
                const nm = n.i.value.trim();
                if (nm.length < 2) throw new Error("datos_invalidos");
                const r = await R("equipo_crear", { p_nombre: nm, p_logo: pk.get() || null });
                done(r, u); view();
            });
            c.append(n.w, pk.w, err, go);
            if (missing) say(msg(new Error("PGRST202")));
            return;
        }

        const t = team, dueno = !!t.soy_dueno;
        head(c, t);
        c.appendChild(E("p", "vs", (t.miembros || []).length + " integrante" + ((t.miembros || []).length === 1 ? "" : "s")));
        const ls = E("div", "tml");
        (t.miembros || []).forEach(m => {
            const row = E("div", "tmr"), isO = m.usuario === t.dueno;
            row.append(E("b", "", (m.nombre || m.usuario)[0].toUpperCase()), E("span", "", (m.nombre || m.usuario) + (isO ? "  \ud83d\udc51" : "")));
            if (dueno && !isO) {
                const x = E("button", "tmx", "\u2715");
                x.type = "button"; x.title = "Quitar del equipo";
                x.onclick = () => run(x, async () => { done(await R("equipo_quitar", { p_usuario: m.usuario }), u); view(); });
                row.appendChild(x);
            }
            ls.appendChild(row);
        });
        c.appendChild(ls);

        if (dueno) {
            const a = api.field("Usuario a a\u00f1adir", "text", "off", "\ud83d\udc64"), add = E("button", "acsub", "A\u00f1adir al equipo");
            add.type = "button";
            add.onclick = () => run(add, async () => {
                const v = a.i.value.trim();
                if (!v) throw new Error("no_existe");
                done(await R("equipo_agregar", { p_usuario: v }), u); view();
            });
            c.append(E("h3", "tmt", "A\u00f1adir integrante"), a.w, add);

            const en = api.field("Nombre del equipo", "text", "off", "\ud83c\udff7"), pk = picker(t.logo || ""), sv = E("button", "acsub", "Guardar cambios");
            en.i.maxLength = 24; en.i.value = t.nombre;
            pk.w.addEventListener("tmerr", e => say(e.detail));
            sv.type = "button";
            sv.onclick = () => run(sv, async () => {
                const lg = pk.get();
                done(await R("equipo_editar", { p_nombre: en.i.value.trim(), p_logo: lg === undefined ? null : lg }), u); view();
            });
            c.append(E("h3", "tmt", "Nombre y logo"), en.w, pk.w, sv);
        }

        const out = E("button", "acout", dueno ? "Disolver equipo" : "Salir del equipo");
        out.type = "button";
        out.onclick = () => {
            if (!confirm(dueno ? "\u00bfDisolver el equipo? Se quitar\u00e1 a todos los integrantes." : "\u00bfSalir del equipo?")) return;
            run(out, async () => { await R("equipo_quitar", { p_usuario: "" }); done(null, u); view(); });
        };
        c.append(err, out);
    }

    window.rdEquipos = {
        boton() {
            const b = E("button", "acsub tm", team ? "\ud83d\udc65 Mi equipo: " + team.nombre : "\ud83d\udc65 Crear un equipo");
            b.type = "button";
            b.onclick = () => { view(); load(); };
            load();
            return b;
        },
        decorar(c) {
            if (!team) return;
            const h = c.querySelector("h2");
            if (!h) return;
            const t = E("div", "tmtag");
            if (team.logo) { const i = E("img", "tmlogo"); i.src = team.logo; i.alt = ""; t.appendChild(i); }
            t.appendChild(E("span", "", team.nombre));
            h.after(t);
        },
        pill(p) {
            if (!team || !team.logo) return;
            const i = E("img", "tmlogo"), s = p.querySelector("span");
            i.src = team.logo; i.alt = "";
            s ? p.insertBefore(i, s) : p.appendChild(i);
        },
        logo: () => team && team.logo || ""
    };
    sig = "";
})();

;
/**
 * Lugar: fondo de la página (gratis para todos).
 * Se guarda en "pioneerLugar", así que viaja con las configuraciones de la cuenta.
 */

(() => {
    const E = mkEl, K = "pioneerLugar", D = "assets/img/lugares/";
    const L = [["", "Sin lugar", "\u26AB"], ["colmado", "Colmado Ricky"], ["discoteca", "Discoteca"], ["campo", "Casa en el campo"]];
    const bg = E("div");
    bg.id = "lug";
    document.body.appendChild(bg);
    const get = () => { try { return localStorage.getItem(K) || ""; } catch (e) { return ""; } };
    function set(id) {
        try { id ? localStorage.setItem(K, id) : localStorage.removeItem(K); } catch (e) { }
        paint();
    }
    // Lugares de EVENTOS (los pone el juez): cambian el fondo mientras estás en el evento y no se guardan.
    //   Si existe assets/img/lugares/<nombre>.webp se usa esa foto; si no, un fondo de color con el nombre.
    let temp = null;
    const slug = n => String(n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const COL = [["#3a1c5e", "#0e2a4d"], ["#5e2a1c", "#2a0e1c"], ["#1c5e3a", "#0e2a2a"], ["#5e4b1c", "#2a1e0e"]];
    function pintarTemp(n) {
        const id = slug(n), c = COL[(id.length + id.charCodeAt(0)) % COL.length], img = new Image();
        bg.style.backgroundImage = "linear-gradient(160deg," + c[0] + "," + c[1] + ")";
        bg.classList.add("on"); document.body.classList.add("lugar");
        img.onload = () => { if (temp === n) bg.style.backgroundImage = "url(" + D + id + ".webp)"; };
        img.src = D + id + ".webp";
    }
    function paint() {
        if (temp) { pintarTemp(temp); return; }
        const id = get(), ok = L.some(x => x[0] === id && id);
        bg.style.backgroundImage = ok ? "url(" + D + id + ".webp)" : "none";
        bg.classList.toggle("on", ok);
        document.body.classList.toggle("lugar", ok);
    }
    function open() {
        const api = window.rdApi;
        if (!api) return;
        const c = api.card("lug"), g = E("div", "lgrid");
        c.append(E("div", "ach", "\uD83D\uDCCD"), E("h2", "", "Cambia tu lugar"), E("p", "vs", "Elige d\u00f3nde suena tu radio. Es gratis para todos."), g);
        const draw = () => {
            g.textContent = "";
            L.forEach(([id, n, e]) => {
                const b = E("button", "lopt" + (get() === id ? " on" : "")), t = id ? E("img") : E("i", "", e);
                b.type = "button";
                if (id) { t.src = D + id + "-mini.webp"; t.alt = n; t.draggable = false; }
                b.append(t, E("span", "", n));
                b.onclick = () => { set(id); draw(); };
                g.appendChild(b);
            });
        };
        draw();
    }
    window.rdLugar = { temporal(n) { temp = n || null; paint(); } };
    const b = document.getElementById("lugb");
    if (b) b.addEventListener("click", open);
    paint();
})();

;
/**
 * Mover la radio
 * Botón "Mover radio" (fijo abajo a la izquierda): al activarlo puedes arrastrar toda la radio
 * (con el dedo o el mouse) a donde quieras. Se guarda la posición.
 * Doble toque / doble clic sobre el botón = volver a su sitio.
 */

{
    const KEY = "rdPosRadio";
    const caja = document.querySelector(".casew");
    if (caja) {
        let x = 0, y = 0, modo = false;

        // --- posición guardada ---
        try {
            const g = JSON.parse(localStorage.getItem(KEY) || "null");
            if (g) { x = +g.x || 0; y = +g.y || 0; }
        } catch (e) { }

        const poner = () => {
            const t = (x || y) ? "translate(" + x + "px," + y + "px)" : "";
            caja.style.transform = t;
            caja.style.webkitTransform = t;
        };
        const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify({ x: x, y: y })); } catch (e) { } };

        // --- botón Mover ---
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mvbtn";
        btn.textContent = "✥ Mover radio";
        btn.title = "Activa y arrastra la radio. Doble toque = volver a su lugar";
        document.body.appendChild(btn);        // fijo en la pantalla (abajo a la izquierda), siempre visible

        const activar = on => {
            modo = on;
            caja.classList.toggle("mover", on);
            document.body.classList.toggle("mover-on", on);
            btn.textContent = on ? "✓ Listo" : "✥ Mover radio";
        };
        btn.addEventListener("click", () => activar(!modo));
        btn.addEventListener("dblclick", () => { x = y = 0; poner(); guardar(); activar(false); });

        // --- arrastre ---
        let arr = false, sx = 0, sy = 0, ox = 0, oy = 0;
        const pt = e => (e.touches && e.touches[0]) ? e.touches[0] : e;

        const ini = e => {
            if (!modo || e.target === btn) return;
            const p = pt(e);
            arr = true; sx = p.clientX; sy = p.clientY; ox = x; oy = y;
            e.preventDefault(); e.stopPropagation();   // que no se muevan perillas ni botones
        };
        const mov = e => {
            if (!arr) return;
            const p = pt(e);
            x = ox + (p.clientX - sx);
            y = oy + (p.clientY - sy);
            poner();
            e.preventDefault();
        };
        const fin = () => { if (arr) { arr = false; guardar(); } };

        // captura = antes que los controles de la radio
        ["mousedown", "touchstart"].forEach(n => caja.addEventListener(n, ini, true));
        ["mousemove", "touchmove"].forEach(n => document.addEventListener(n, mov, { passive: false }));
        ["mouseup", "touchend", "touchcancel"].forEach(n => document.addEventListener(n, fin));
        // en modo mover, los clics normales no deben activar nada
        caja.addEventListener("click", e => { if (modo && e.target !== btn) { e.preventDefault(); e.stopPropagation(); } }, true);

        poner();
    }
}

;
/**
 * Stand del radio + cámara (alejar / acercar)
 * El radio es HTML/CSS (2D), así que NO se simula 3D: el stand (bandeja de madera sobre un trípode negro) es CSS pegado debajo de la caja
 * (dentro de .casew, así se mueve y se escala junto con el radio) y el "zoom" es la propiedad CSS `scale`
 * sobre .casew (no choca con el transform de "Mover radio", que sigue funcionando).
 * Controles: botones − / + / centrar (abajo al centro), rueda del ratón (sobre el radio) o Ctrl+rueda (en cualquier parte)
 * y pellizco con dos dedos sobre el radio. Zoom mínimo y máximo configurables abajo. Se guarda en este navegador.
 */
{
    const ZMIN = 0.45, ZMAX = 1.6, PASO = 0.12, KEY = "rdZoomRadio";
    const caja = document.querySelector(".casew");
    if (caja) {
        // ---------- stand (se crea una sola vez) ----------
        const st = document.createElement("div");
        st.className = "rstand";
        st.innerHTML = '<i class="rs-pared l"></i><i class="rs-pared r"></i><i class="rs-top"></i><i class="rs-borde"></i><i class="rs-sombra"></i><i class="rs-placa"></i><i class="rs-poste"></i><i class="rs-pierna a"></i><i class="rs-pierna b"></i><i class="rs-pierna c"></i><i class="rs-pie a"></i><i class="rs-pie b"></i><i class="rs-suelo"></i>';
        caja.appendChild(st);

        // ---------- cámara ----------
        let z = 1, meta = 1, raf = 0;
        try { const g = parseFloat(localStorage.getItem(KEY)); if (g) z = meta = Math.max(ZMIN, Math.min(ZMAX, g)); } catch (e) { }
        const lim = x => Math.max(ZMIN, Math.min(ZMAX, x));
        const aplicar = () => {
            caja.style.scale = Math.abs(z - 1) < .005 ? "" : String(z);
            caja.style.transformOrigin = "50% 0";
            // cuando se aleja, el espacio que sobra se recorta para no dejar la página larga y vacía
            caja.style.marginBottom = z < 1 ? (-(1 - z) * caja.offsetHeight) + "px" : "";
            pct.textContent = Math.round(z * 100) + "%";
            menos.disabled = meta <= ZMIN + .001;
            mas.disabled = meta >= ZMAX - .001;
        };
        const paso = () => {
            raf = 0;
            const d = meta - z;
            if (Math.abs(d) < .003) z = meta; else z += d * .22;
            aplicar();
            if (z !== meta) raf = requestAnimationFrame(paso);
        };
        const ir = (x, guardar) => {
            meta = lim(x);
            if (guardar !== false) try { localStorage.setItem(KEY, String(meta)); } catch (e) { }
            if (!raf) raf = requestAnimationFrame(paso);
        };

        // ---------- botones ----------
        const bar = document.createElement("div");
        bar.className = "camb";
        bar.setAttribute("role", "group");
        bar.setAttribute("aria-label", "Cámara del radio");
        const mk = (t, tit, f) => { const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.title = tit; b.setAttribute("aria-label", tit); b.addEventListener("click", f); return b; };
        const menos = mk("−", "Alejar la cámara", () => ir(meta - PASO));
        const mas = mk("+", "Acercar la cámara", () => ir(meta + PASO));
        const pct = document.createElement("span");
        const cen = mk("⌖", "Centrar y restablecer (zoom 100 % y posición)", () => {
            ir(1);
            const mv = document.querySelector(".mvbtn");
            if (mv) mv.dispatchEvent(new Event("dblclick"));
        });
        pct.className = "camp";
        bar.append(menos, pct, mas, cen);
        document.body.appendChild(bar);
        // que los atajos de teclado del radio no se disparen con estos botones
        bar.addEventListener("keydown", e => e.stopPropagation());

        // ---------- rueda ----------
        document.addEventListener("wheel", e => {
            if (e.defaultPrevented) return;                 // una perilla o un panel ya la usó
            const sobre = e.target.closest && e.target.closest(".casew");
            if (!sobre && !e.ctrlKey) return;
            if (e.target.closest && e.target.closest(".vm,.batd,.btm,input,select,textarea")) return;
            e.preventDefault();
            ir(meta * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
        }, { passive: false });

        // ---------- pellizco (dos dedos sobre el radio) ----------
        const dedos = new Map();
        let d0 = 0, z0 = 1;
        const dist = () => { const p = [...dedos.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
        caja.style.touchAction = "pan-x pan-y";
        caja.addEventListener("pointerdown", e => {
            if (e.pointerType !== "touch") return;
            dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (dedos.size === 2) { d0 = dist() || 1; z0 = meta; }
        });
        caja.addEventListener("pointermove", e => {
            if (!dedos.has(e.pointerId)) return;
            dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (dedos.size === 2) { meta = lim(z0 * dist() / d0); z = meta; aplicar(); }
        });
        const suelta = e => { if (dedos.delete(e.pointerId) && dedos.size < 2) { try { localStorage.setItem(KEY, String(meta)); } catch (x) { } } };
        caja.addEventListener("pointerup", suelta);
        caja.addEventListener("pointercancel", suelta);

        // si cambia el tamaño de la ventana o de la caja, se recalcula el recorte
        if (window.ResizeObserver) new ResizeObserver(() => { if (z < 1) aplicar(); }).observe(caja);
        aplicar();
        window.rdCamara = { ir, get zoom() { return meta; }, ZMIN, ZMAX };
    }
}

;
/**
 * Baterías, monedas y tienda
 *
 * - Cada cuenta tiene una batería principal (+ adicionales). Su carga y el voltaje del equipo salen de la simulación de
 *   js/data/baterias-config.js y gobiernan el voltímetro (vmBase) y la potencia de salida (VG).
 * - Protección: con el voltaje crítico (o poca carga) el volumen de salida baja; con la batería agotada el sonido se corta.
 * - El SERVIDOR (SQL-BATERIAS.sql) guarda monedas, compras, baterías, la recarga y la recompensa por tiempo. Aquí solo se muestra y se pide.
 * - Sin sesión (o sin base de datos) todo queda como antes: voltímetro con 12.6 V / 14.4 V del interruptor "Más voltaje".
 */
{
    const C = BAT_CFG, api = () => window.rdApi;
    const REM = () => !!(window.RD_DB_URL && window.RD_DB_KEY);
    const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const fmt = (n, d) => Number(n).toFixed(d == null ? 0 : d);
    const pct = x => Math.round(Math.max(0, Math.min(1, x)) * 100);
    const MSG = {
        sin_fondos: "No tienes monedas suficientes.", inventario_lleno: "Tu inventario está lleno (máximo 12 baterías).", incompatible: "No es compatible: solo se combinan baterías de la misma familia (litio con litio, gelatina con gelatina).",
        sin_ranuras: "No quedan ranuras para baterías adicionales.", recargando: "Termina o cancela la recarga primero.", ya_cargada: "Tus baterías ya están cargadas.", ya_instalada: "Esa batería ya está instalada.",
        no_existe: "Ese artículo ya no está disponible.", datos_invalidos: "Datos no válidos.", sesion: "Tu sesión no está conectada. Cierra sesión y entra de nuevo con internet."
    };
    const errTxt = e => { const m = String(e && e.message || ""); return MSG[m] || (e && e.net ? "No se pudo conectar con el servidor." : "No se pudo completar la acción. Inténtalo de nuevo."); };

    // ---------- estado ----------
    let S = null;                 // respuesta del servidor (bat_estado)
    let U = [];                   // baterías con su carga local
    let rec = null;               // recarga en curso { dur, t0, trans0, soc0: {id: soc} }
    let usuario = "", sucio = false, ocupado = false, avisoApagado = false, ultVG = 1, ultTick = 0, cerrandoRec = false;
    let est = { v: C.vReferencia, soc: 1, amp: 0, capUtil: 0, capNom: 0, rInt: 0, resta: 0, estado: "ok", prot: false, off: false };

    const tipoCfg = t => C.tipos[t] || C.tipos.gel100;
    const cat = t => Object.assign({}, tipoCfg(t), ((S && S.catalogo) || []).find(c => c.tipo === t) || {});
    const instalados = () => U.filter(u => u.slot === "principal").concat(U.filter(u => u.slot === "extra"));

    // ---------- servidor ----------
    const call = (fn, a) => api().rpc(fn, Object.assign({ p_token: api().tok() }, a || {}));
    function aplicar(r, forzar) {
        if (!r || typeof r !== "object" || !Array.isArray(r.unidades)) return;
        const antes = {}; U.forEach(u => { antes[u.id] = u.soc; });
        const eraRec = !!rec;
        S = r;
        U = r.unidades.map(u => ({ id: u.id, tipo: u.tipo, slot: u.slot, soc: forzar || eraRec || antes[u.id] == null || r.recarga ? u.soc : Math.min(antes[u.id], u.soc) }));
        if (r.recarga) {
            const soc0 = {}; r.unidades.forEach(u => { soc0[u.id] = u.soc; });
            rec = { dur: r.recarga.dur_s, t0: performance.now(), trans0: r.recarga.transcurrido_s, f0: Math.min(0.9999, r.recarga.frac), soc0 };
        } else rec = null;
        cerrandoRec = false;
        avisarMovimientos(r.mov || []);
        if (abierto) render();
        pintarBoton();
    }
    async function refrescar(forzar) {
        try { aplicar(await call("bat_estado"), forzar); return true; } catch (e) { return false; }
    }
    async function accion(fn, a, okMsg) {
        if (ocupado) return;
        ocupado = true; if (abierto) render();
        try { aplicar(await call(fn, a), true); if (okMsg) aviso(okMsg, true); }
        catch (e) { aviso(errTxt(e), false); }
        ocupado = false; if (abierto) render(); pintarBoton();
    }
    function avisarMovimientos(mov) {
        let visto = 0; try { visto = parseInt(localStorage.getItem("pioneerMovVisto:" + usuario)); } catch (e) { }
        const max = mov.reduce((m, x) => Math.max(m, x.id), 0);
        if (isNaN(visto)) visto = max;                                    // la primera vez no se avisa de lo anterior
        mov.filter(x => x.tipo === "admin" && x.id > visto).reverse().forEach(x => aviso("🪙 Un administrador te dio " + x.monto + " monedas" + (x.detalle ? ": " + x.detalle : "") + ".", true));
        try { localStorage.setItem("pioneerMovVisto:" + usuario, String(Math.max(visto, max))); } catch (e) { }
    }
    async function latido() {
        if (!S || document.hidden) return;
        try {
            const r = await call("eco_latido");
            if (r && typeof r.monedas === "number") {
                S.monedas = r.monedas; S.seg_acum = r.seg_acum;
                if (r.ganadas > 0) { aviso("🪙 +" + r.ganadas + " monedas por tu tiempo en la página", true); refrescar(false); }
                if (abierto) render(); pintarBoton();
            }
        } catch (e) { }
    }
    async function guardar() {
        if (!S || rec || !sucio) return;
        sucio = false;
        try { await call("bat_guardar", { p_socs: instalados().map(u => ({ id: u.id, soc: +u.soc.toFixed(4) })) }); } catch (e) { sucio = true; }
    }

    // ---------- simulación ----------
    function demanda() {
        const I = C.corriente;
        let amp = I.reposo, bajos = 0;
        let sonando = false; try { sonando = !A.paused; } catch (e) { }
        if (sonando) {
            try { if (eqNodes && vmBuf) { const an = eqNodes.an, n = Math.max(3, Math.round(150 / (AC.sampleRate / an.fftSize))); let s = 0; for (let i = 1; i <= n; i++) s += vmBuf[i]; bajos = s / n / 255; } } catch (e) { }
            let nEq = 1; try { nEq = Math.max(1, units.filter(u => !u.byp).length); } catch (e) { }
            let eqx = 1; try { eqx = EQX; } catch (e) { }
            const vol = Math.max(0, Math.min(1, v / VMAX));
            amp += I.maxReproduccion * Math.pow(vol, 1.6) * (1 + I.graves * bajos) * (1 + I.porEqExtra * (nEq - 1)) * (1 + I.porRefuerzoEq * (eqx - 1));
        }
        let masV = false; try { masV = !!cfg.volt; } catch (e) { }
        if (masV) amp *= C.consumoMasVoltaje;
        return { amp, masV };
    }
    function modelo(dtSeg) {
        const ins = instalados();
        if (!ins.length) return null;
        const d = demanda(), pr = tipoCfg(ins[0].tipo);
        let capUtil = 0, capNom = 0, g = 0, carga = 0;
        ins.forEach(u => { const t = tipoCfg(u.tipo); capUtil += t.ah * t.util; capNom += t.ah; g += 1000 / t.rIntMohm; carga += u.soc * t.ah * t.util; });
        // consumo: todas las baterías en paralelo bajan por igual (reparto proporcional a su capacidad)
        if (dtSeg > 0 && !rec) {
            const dsoc = d.amp * dtSeg / 3600 * C.aceleracion / capUtil;
            ins.forEach(u => { u.soc = Math.max(0, u.soc - dsoc); });
            sucio = true;
            carga = ins.reduce((s, u) => s + u.soc * tipoCfg(u.tipo).ah * tipoCfg(u.tipo).util, 0);
        }
        const soc = carga / capUtil, rInt = 1000 / g;
        const ocv = pr.vVacio + (pr.vLleno - pr.vVacio) * (1 - Math.pow(1 - soc, pr.curva));
        let V = ocv - d.amp * rInt / 1000;
        if (d.masV && soc > 0) V = Math.min(pr.vMax, V + C.vExtraMotor);
        if (soc <= 0) V = Math.min(V, pr.vVacio - 0.6);
        const resta = carga / d.amp * 3600 / C.aceleracion;         // segundos de funcionamiento al consumo actual
        const off = soc <= 0.0005, prot = !off && (V <= C.vCritico || soc <= C.cargaCritica);
        const estado = rec ? "carga" : off ? "vacia" : prot ? "critica" : soc < 0.25 ? "baja" : soc >= 0.97 ? "llena" : "ok";
        return { v: V, soc, amp: d.amp, capUtil, capNom, rInt, resta, estado, prot, off };
    }
    function aplicarSistema() {
        // voltímetro y potencia de salida
        try {
            vmBase = est.v;
            let vg = est.off ? 0 : Math.pow(Math.max(est.v, 0) / C.vReferencia, 2) * (est.prot ? C.proteccion : 1);
            if (Math.abs(vg - ultVG) > 0.015 || (vg === 0) !== (ultVG === 0)) { ultVG = vg; VG = vg; applyAudio(); }
        } catch (e) { }
        if (est.off) {
            try { if (!A.paused) { toggle(); } } catch (e) { }
            if (!avisoApagado) { avisoApagado = true; aviso("🔋 Batería agotada: el sonido se cortó. Recárgala desde el menú de baterías.", false); }
        } else if (est.soc > C.cargaCritica * 2) avisoApagado = false;
    }
    function recargaLocal() {
        if (!rec) return;
        const f = Math.min(1, (rec.trans0 + (performance.now() - rec.t0) / 1000) / rec.dur), k = (1 - f) / (1 - rec.f0);
        U.forEach(u => { if (u.slot && rec.soc0[u.id] != null) u.soc = f >= 1 ? 1 : 1 - (1 - rec.soc0[u.id]) * k; });
        if (f >= 1 && !cerrandoRec) { cerrandoRec = true; refrescar(true).then(() => aviso("🔋 Recarga completa.", true)); }
    }
    function tick() {
        if (!S) return;
        const ahora = performance.now(), dt = ultTick ? Math.min(2, (ahora - ultTick) / 1000) : 0; ultTick = ahora;
        recargaLocal();
        const m = modelo(dt);
        if (m) { est = m; aplicarSistema(); }
        pintarBoton(); if (abierto && tab === "rec") pintarRecarga();
    }

    // ---------- avisos ----------
    const toast = h("div", "batts"); document.body.appendChild(toast);
    let tt = 0;
    function aviso(t, ok) { toast.textContent = t; toast.className = "batts show" + (ok ? " ok" : " bad"); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove("show"), 5200); }

    // ---------- botón y menú lateral ----------
    const boton = h("button", "btbtn batbtn"); boton.type = "button"; document.body.appendChild(boton);
    boton.style.display = "none";
    const fondo = h("div", "batm"), drawer = h("div", "batd"); document.body.append(fondo, drawer);
    const cab = h("div", "batcab"), cerrar = h("button", "batx", "✕"); cerrar.type = "button";
    cab.append(h("div", "batt", "🔋 Baterías y monedas"), cerrar);
    const tabs = h("div", "battabs"), cuerpo = h("div", "batcuerpo");
    drawer.append(cab, tabs, cuerpo);
    let tab = "rec", abierto = false;
    const TABS = [["rec", "⚡ Recarga"], ["tie", "🛒 Tienda"], ["inv", "🎒 Inventario"], ["mon", "🪙 Monedas"]];
    TABS.forEach(([id, t]) => { const b = h("button", "", t); b.type = "button"; b.dataset.t = id; b.onclick = () => { tab = id; render(); }; tabs.appendChild(b); });
    function abrir() {
        if (!api() || !api().user()) { api() && api().login && api().login(); return; }
        abierto = true; fondo.classList.add("on"); drawer.classList.add("on"); render(); refrescar(false);
    }
    function cerrarMenu() { abierto = false; fondo.classList.remove("on"); drawer.classList.remove("on"); }
    boton.onclick = abrir; cerrar.onclick = cerrarMenu; fondo.onclick = cerrarMenu;
    try { const vm = document.getElementById("vms"); if (vm && vm.parentNode) { vm.parentNode.style.cursor = "pointer"; vm.parentNode.title = "Baterías y recarga"; vm.parentNode.addEventListener("click", abrir); } } catch (e) { }

    function pintarBoton() {
        if (!S) { boton.style.display = "none"; return; }
        boton.style.display = "";
        boton.textContent = "🔋 " + pct(est.soc) + "% · 🪙 " + S.monedas;
        boton.classList.toggle("bajo", est.estado === "baja" || est.estado === "critica" || est.estado === "vacia");
    }

    // ---------- ilustración ----------
    function dibujo(fam) {
        fam = fam === "litio" ? "litio" : "gel";   /* solo dos valores: nunca se mete texto del servidor en el SVG */
        const lit = fam === "litio", c1 = lit ? "#0f8f8a" : "#3d4b5c", c2 = lit ? "#18d0c4" : "#6a7d93", tx = lit ? "Li" : "GEL";
        return '<svg viewBox="0 0 120 70" width="100%" height="64" aria-hidden="true"><defs><linearGradient id="bg' + fam + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c2 + '"/><stop offset="1" stop-color="' + c1 + '"/></linearGradient></defs>' +
            '<rect x="10" y="14" width="100" height="48" rx="7" fill="url(#bg' + fam + ')" stroke="#0008" stroke-width="2"/><rect x="26" y="6" width="16" height="9" rx="2" fill="#c9c9c9"/><rect x="78" y="6" width="16" height="9" rx="2" fill="#c9c9c9"/>' +
            '<text x="60" y="46" text-anchor="middle" font-family="Arial" font-weight="700" font-size="22" fill="#fff" opacity=".92">' + tx + '</text></svg>';
    }
    const tiempo = s => { s = Math.max(0, Math.round(s)); if (s >= 3600) return Math.floor(s / 3600) + " h " + Math.floor(s % 3600 / 60) + " min"; return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
    const duracionEst = t => { const x = tipoCfg(t); return x.ah * x.util / C.referenciaAmp * 3600 / C.aceleracion; };
    const ESTADO = { llena: "Cargada", ok: "Normal", baja: "Carga baja: conviene recargar", critica: "¡Crítica! Protección activa (volumen reducido)", vacia: "Descargada: necesita recarga", carga: "Recargando..." };

    // ---------- contenido ----------
    let R = {};                           // elementos de la pestaña de recarga (se actualizan cada medio segundo)
    function render() {
        [...tabs.children].forEach(b => b.classList.toggle("on", b.dataset.t === tab));
        cuerpo.textContent = ""; R = {};
        if (!S) { cuerpo.appendChild(h("p", "batnota", REM() ? "Cargando tu cuenta..." : "Las baterías necesitan la conexión con tu cuenta.")); return; }
        ({ rec: vRecarga, tie: vTienda, inv: vInventario, mon: vMonedas })[tab]();
    }
    const sec = t => { const s = h("div", "batsec"); if (t) s.appendChild(h("h3", "", t)); cuerpo.appendChild(s); return s; };
    const btn = (t, f, cls) => { const b = h("button", "batb " + (cls || ""), t); b.type = "button"; b.onclick = f; if (ocupado) b.disabled = true; return b; };

    function vRecarga() {
        const s = sec();
        R.v = h("div", "batvolt"); R.est = h("div", "batest");
        R.barra = h("div", "batbar"); R.barraI = h("i"); R.barra.appendChild(R.barraI);
        R.pct = h("div", "batpct");
        s.append(R.v, R.barra, R.pct, R.est);
        const g = h("div", "batgrid"); R.dat = g; s.appendChild(g);
        R.ctl = h("div", "batctl"); s.appendChild(R.ctl);
        R.prog = h("div", "batprog"); R.progI = h("i"); R.prog.appendChild(R.progI); R.progT = h("div", "batprogt");
        s.append(R.prog, R.progT);
        s.appendChild(h("p", "batnota", "Recarga completa ≈ 5 minutos reales (el litio, menos). Todas las baterías instaladas se cargan a la vez. Puedes seguir usando el radio, pero la carga sube solo con la recarga."));
        pintarRecarga();
    }
    function pintarRecarga() {
        if (!R.v) return;
        const ins = instalados(), pr = ins[0], cargando = !!rec;
        R.v.textContent = fmt(est.v, 1) + " V";
        R.barraI.style.width = pct(est.soc) + "%"; R.barra.className = "batbar " + est.estado;
        R.pct.textContent = pct(est.soc) + " %";
        R.est.textContent = ESTADO[est.estado] || "";
        const dat = [
            ["Batería principal", pr ? cat(pr.tipo).nombre : "—"],
            ["Adicionales", ins.length - 1 + " / " + S.max_extras],
            ["Capacidad total", fmt(est.capNom) + " Ah (" + fmt(est.capUtil) + " Ah útiles)"],
            ["Consumo ahora", fmt(est.amp, 1) + " A"],
            ["Duración estimada", cargando ? "—" : (est.amp > 0 ? tiempo(est.resta) : "—")],
            ["Resistencia interna", fmt(est.rInt, 1) + " mΩ"]
        ];
        const clave = dat.map(x => x[1]).join("|");
        if (R.datK !== clave) { R.datK = clave; R.dat.textContent = ""; dat.forEach(x => { const f = h("div", "batfila"); f.append(h("span", "", x[0]), h("b", "", x[1])); R.dat.appendChild(f); }); }
        const k = (cargando ? "c" : "n") + ocupado + (est.soc >= 0.999);
        if (R.ctlK !== k) {
            R.ctlK = k; R.ctl.textContent = "";
            if (cargando) R.ctl.appendChild(btn("✖ Cancelar recarga", () => accion("bat_recarga_cancelar", {}, "Recarga cancelada."), "bad"));
            else R.ctl.appendChild(btn("⚡ Iniciar recarga", () => accion("bat_recarga_iniciar", {}, "Recarga iniciada."), "ok"));
            if (est.soc >= 0.999 && !cargando) R.ctl.firstChild.disabled = true;
        }
        R.prog.style.display = R.progT.style.display = cargando ? "" : "none";
        if (cargando) {
            const f = Math.min(1, (rec.trans0 + (performance.now() - rec.t0) / 1000) / rec.dur);
            R.progI.style.width = pct(f) + "%";
            R.progT.textContent = "Recargando: " + pct(f) + " % · faltan " + tiempo(rec.dur * (1 - f));
        }
    }

    function vTienda() {
        const s = sec("Tienda de baterías"); s.appendChild(h("p", "batsaldo", "🪙 Tu saldo: " + S.monedas + " monedas"));
        S.catalogo.forEach(c0 => {
            const c = cat(c0.tipo), tiene = U.filter(u => u.tipo === c.tipo).length, card = h("div", "batcard");
            const ic = h("div", "batic"); ic.innerHTML = dibujo(c.familia);
            const info = h("div", "batinfo");
            info.append(h("div", "batnom", c.nombre), h("div", "batcal", c.calidad + " · " + c.ah + " Ah · " + fmt(c.vLleno, 1) + " V"),
                h("div", "batdesc", c.descripcion), h("div", "batmeta", "Energía útil " + fmt(c.ah * c.util) + " Ah · Duración ≈ " + tiempo(duracionEst(c.tipo)) + " (consumo medio) · Recarga " + tiempo(c0.recarga_s)));
            const pie = h("div", "batpie");
            pie.append(h("b", "batprecio", "🪙 " + c0.precio), h("span", "batown", tiene ? "En tu inventario: " + tiene : "No la tienes"));
            const comprar = btn(S.monedas < c0.precio ? "Sin monedas suficientes" : "Comprar", async () => {
                await accion("tienda_comprar", { p_tipo: c.tipo, p_req: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }, "✔ Compraste: " + c.nombre);
            }, "ok");
            if (S.monedas < c0.precio) comprar.disabled = true;
            pie.appendChild(comprar);
            card.append(ic, info, pie); s.appendChild(card);
        });
    }

    function vInventario() {
        const ins = instalados(), s = sec("Tu equipo"), pr = ins[0];
        s.appendChild(h("p", "batnota", "Principal: " + (pr ? cat(pr.tipo).nombre : "—") + " · Adicionales " + (ins.length - 1) + "/" + S.max_extras + " · Capacidad total " + fmt(est.capNom) + " Ah (" + fmt(est.capUtil) + " Ah útiles). Las baterías se conectan en paralelo: suman capacidad y duración, el voltaje no se suma."));
        const lista = sec("Baterías compradas");
        if (!U.length) lista.appendChild(h("p", "batnota", "Aún no tienes baterías."));
        U.slice().sort((a, b) => (a.slot === "principal" ? 0 : a.slot ? 1 : 2) - (b.slot === "principal" ? 0 : b.slot ? 1 : 2) || a.id - b.id).forEach(u => {
            const c = cat(u.tipo), f = h("div", "batcard slim");
            const ic = h("div", "batic sm"); ic.innerHTML = dibujo(c.familia);
            const info = h("div", "batinfo");
            const bar = h("div", "batbar mini"); const bi = h("i"); bi.style.width = pct(u.soc) + "%"; bar.appendChild(bi);
            info.append(h("div", "batnom", c.nombre), h("div", "batcal", (u.slot === "principal" ? "🔌 Principal" : u.slot === "extra" ? "➕ Adicional instalada" : "📦 En inventario") + " · carga " + pct(u.soc) + " %"), bar);
            const ac = h("div", "batpie");
            if (u.slot === "") {
                ac.append(btn("Instalar como principal", () => accion("bat_instalar", { p_unidad: u.id, p_slot: "principal" }, "Batería principal cambiada.")));
                ac.append(btn("Instalar adicional (🪙 " + S.costo_extra + ")", () => accion("bat_instalar", { p_unidad: u.id, p_slot: "extra" }, "Batería adicional instalada.")));
            } else if (u.slot === "extra") ac.append(btn("Retirar", () => accion("bat_retirar", { p_unidad: u.id }, "Batería retirada.")));
            if (rec) ac.querySelectorAll("button").forEach(b => { b.disabled = true; });
            f.append(ic, info, ac); lista.appendChild(f);
        });
        if (rec) lista.appendChild(h("p", "batnota", "No puedes cambiar baterías mientras recargas."));
    }

    function vMonedas() {
        const s = sec("Monedas"); s.appendChild(h("div", "batbig", "🪙 " + S.monedas));
        const f = Math.min(1, S.seg_acum / S.hora_seg), bar = h("div", "batbar"), bi = h("i"); bi.style.width = pct(f) + "%"; bar.appendChild(bi);
        s.append(h("p", "batnota", "Recompensa: " + S.hora_monedas + " monedas por cada hora en la página (el tiempo lo cuenta el servidor y se conserva aunque cierres)."), bar,
            h("p", "batnota", "Próxima recompensa: " + Math.floor(S.seg_acum / 60) + " de " + Math.floor(S.hora_seg / 60) + " minutos (faltan " + Math.ceil((S.hora_seg - S.seg_acum) / 60) + " min)."));
        const filtros = [["todo", "Todo"], ["compra", "Compras"], ["recompensa", "Recompensas"], ["admin", "De administradores"]];
        const barra = h("div", "batfiltros"), lista = h("div", "batmov");
        let fil = "todo";
        const pintar = () => {
            [...barra.children].forEach(b => b.classList.toggle("on", b.dataset.f === fil)); lista.textContent = "";
            const m = S.mov.filter(x => fil === "todo" || x.tipo === fil || (fil === "compra" && x.tipo === "instalacion"));
            if (!m.length) lista.appendChild(h("p", "batnota", "Sin movimientos."));
            m.forEach(x => { const r = h("div", "batfila"); r.append(h("span", "", new Date(x.creado).toLocaleString() + " · " + x.detalle + (x.admin ? " (por " + x.admin + ")" : "")), h("b", x.monto < 0 ? "neg" : "pos", (x.monto > 0 ? "+" : "") + x.monto)); lista.appendChild(r); });
        };
        filtros.forEach(([id, t]) => { const b = h("button", "", t); b.type = "button"; b.dataset.f = id; b.onclick = () => { fil = id; pintar(); }; barra.appendChild(b); });
        const h2 = sec("Historial"); h2.append(barra, lista); pintar();
    }

    // ---------- arranque y ciclo de vida ----------
    let timers = [];
    function activar(u) {
        usuario = u; S = null; U = []; rec = null; ultTick = 0; avisoApagado = false;
        refrescar(true).then(ok => {
            if (!ok || usuario !== u) return;
            latido();
            timers.push(setInterval(tick, C.tickMs), setInterval(guardar, C.guardarCadaMs), setInterval(latido, C.latidoCadaMs), setInterval(() => refrescar(false), C.refrescarCadaMs));
        });
    }
    function desactivar() {
        timers.forEach(clearInterval); timers = []; S = null; U = []; rec = null; usuario = ""; cerrarMenu(); pintarBoton();
        try { vmBase = cfg.volt ? 14.4 : 12.6; VG = Math.pow(vmBase / 12.6, 2); ultVG = VG; applyAudio(); } catch (e) { }
    }
    setInterval(() => {
        const u = REM() && api() && api().user ? api().user() : null;
        if (u && u !== usuario) { if (usuario) desactivar(); activar(u); }
        else if (!u && usuario) desactivar();
    }, 2000);
    addEventListener("pagehide", () => { sucio = true; guardar(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { sucio = true; guardar(); } });
    window.rdBaterias = { abrir, estado: () => est };
}

;
/**
 * Online - Cliente mínimo de Supabase Realtime (protocolo Phoenix, sin librerías)
 * Sirve para: chat, lista de salas (presencia) y señales de las batallas.
 *
 *   const c = RT.canal("nombre-del-canal", "mi-clave-de-presencia");
 *   c.on("evento", datos => ...);   c.enviar("evento", {..});   c.presencia(fn);   c.track({..});   c.salir();
 *
 * Usa la misma URL y clave pública que el resto de la página (config.js: RD_DB_URL / RD_DB_KEY).
 */

const RT = (() => {
    const canales = {};
    let ws = null, ref = 0, abierto = false, hb = 0, intentos = 0;

    const url = () => String(window.RD_DB_URL).replace(/^http/, "ws") + "/realtime/v1/websocket?apikey=" + encodeURIComponent(window.RD_DB_KEY) + "&vsn=1.0.0";
    const mandar = m => { m.ref = String(++ref); if (abierto) { try { ws.send(JSON.stringify(m)); } catch (e) { } } return m.ref; };

    const conectar = () => {
        if (ws && ws.readyState < 2) return;
        try { ws = new WebSocket(url()); } catch (e) { return; }
        ws.onopen = () => {
            abierto = true; intentos = 0;
            clearInterval(hb);
            hb = setInterval(() => mandar({ topic: "phoenix", event: "heartbeat", payload: {} }), 25000);
            Object.keys(canales).forEach(k => canales[k]._unir());
        };
        ws.onmessage = e => {
            let m; try { m = JSON.parse(e.data); } catch (x) { return; }
            const c = canales[m.topic];
            if (c) c._recibir(m);
        };
        ws.onclose = () => {
            abierto = false; clearInterval(hb);
            Object.keys(canales).forEach(k => { canales[k].listo = false; });
            if (Object.keys(canales).length) setTimeout(conectar, Math.min(10000, 1000 * ++intentos));
        };
        ws.onerror = () => { };
    };

    function canal(nombre, clave) {
        const topic = "realtime:" + nombre;
        if (canales[topic]) return canales[topic];
        const c = {
            topic, listo: false, meta: null, pres: {}, h: {}, onPres: null, joinRef: null,
            on(ev, fn) { c.h[ev] = fn; return c; },
            presencia(fn) { c.onPres = fn; return c; },
            // lista de metadatos de todos los conectados al canal: [{ clave, ...meta }]
            quien() { const r = []; Object.keys(c.pres).forEach(k => c.pres[k].forEach(m => r.push(Object.assign({ _k: k }, m)))); return r; },
            track(meta) { c.meta = meta; if (c.listo) mandar({ topic, event: "presence", payload: { type: "presence", event: "track", payload: meta } }); return c; },
            enviar(ev, datos) { if (c.listo) mandar({ topic, event: "broadcast", payload: { type: "broadcast", event: ev, payload: datos } }); },
            salir() { mandar({ topic, event: "phx_leave", payload: {} }); delete canales[topic]; if (!Object.keys(canales).length && ws) { try { ws.close(); } catch (e) { } } },
            _unir() {
                c.joinRef = mandar({ topic, event: "phx_join", payload: { config: { broadcast: { self: false, ack: false }, presence: { key: clave || ("u" + Math.random().toString(36).slice(2, 8)) }, private: false } } });
            },
            _recibir(m) {
                const p = m.payload || {};
                if (m.event === "phx_reply" && m.ref === c.joinRef) {
                    if (p.status === "ok") { c.listo = true; if (c.meta) c.track(c.meta); if (c.h.__listo) c.h.__listo(); }
                    else if (c.h.__error) c.h.__error(p);
                }
                else if (m.event === "broadcast") { const f = c.h[p.event]; if (f) { try { f(p.payload); } catch (e) { } } }
                else if (m.event === "presence_state") {
                    c.pres = {};
                    Object.keys(p).forEach(k => { c.pres[k] = (p[k].metas || []); });
                    if (c.onPres) c.onPres();
                }
                else if (m.event === "presence_diff") {
                    const sale = p.leaves || {}, entra = p.joins || {};
                    Object.keys(sale).forEach(k => {
                        const refs = (sale[k].metas || []).map(x => x.phx_ref);
                        c.pres[k] = (c.pres[k] || []).filter(x => refs.indexOf(x.phx_ref) < 0);
                        if (!c.pres[k].length) delete c.pres[k];
                    });
                    Object.keys(entra).forEach(k => { c.pres[k] = (c.pres[k] || []).concat(entra[k].metas || []); });
                    if (c.onPres) c.onPres();
                }
            }
        };
        canales[topic] = c;
        conectar();
        if (abierto) c._unir();
        return c;
    }

    return { canal };
})();

;
/**
 * Online - Audio en vivo (WebRTC)
 * Un "emisor" (el que suena) transmite el audio de SU radio (con su EQ, crossover, etc.) a todos los demás
 * de la sala; los demás lo escuchan. Las señales para conectarse viajan por el canal de Realtime de la sala.
 *
 *   AV.usar(canal, miUsuario)      enlaza con la sala (canal = RT.canal(...))
 *   AV.emitir(listaDeUsuarios)     empieza a transmitir a esos usuarios (y pone a sonar tu radio si estaba en pausa)
 *   AV.nuevo(usuario)              si estoy transmitiendo, ofrece el audio a alguien que acaba de entrar
 *   AV.parar()                     deja de transmitir y pausa tu radio
 *   AV.cerrar()                    cierra todo (al salir de la sala)
 *   AV.volumen(0..1)               volumen de lo que escuchas
 *   AV.transmitiendo()             ¿estoy transmitiendo ahora?
 * Nota: el volumen de TU radio afecta lo que escuchan los demás. Sin servidor TURN, algunas redes muy
 * restringidas (datos móviles con NAT estricto) pueden no conectar.
 */

const AV = (() => {
    /* STUN + TURN. El TURN (servidor intermedio) hace falta en datos m\u00f3viles y redes con NAT estricto; estos son p\u00fablicos y gratis (pueden
       fallar o ir lentos). Si tienes uno propio, en config.js pon: window.RD_ICE = [{ urls: "turn:...", username: "...", credential: "..." }] */
    const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }].concat(window.RD_ICE || [
        { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" }]) };
    const avisar = t => { try { if (typeof AV !== "undefined" && AV.aviso) AV.aviso(t); } catch (e) { } };
    const pendEnv = {};                // candidatos que llegaron antes de la respuesta (lado emisor)
    let canal = null, yo = "", destino = null, emitiendo = false, vol = 1;
    let enviando = {};                 // enviando[usuario]  = conexión mía hacia esa persona
    let recibiendo = {}, pend = {};    // recibiendo[usuario] = conexión de quien me transmite
    const audios = {};                 // un <audio> por emisor

    const senal = (para, tipo, datos) => { if (canal) canal.enviar("senal", { de: yo, para, tipo, datos }); };

    function flujoLocal() {
        try { if (typeof initAudio === "function") initAudio(); } catch (e) { }
        if (typeof AC === "undefined" || !AC || !eqCp || !AC.createMediaStreamDestination) return null;
        if (!destino) { destino = AC.createMediaStreamDestination(); eqCp.connect(destino); }
        return destino.stream;
    }

    async function ofrecer(para) {
        const fl = destino && destino.stream;
        if (!fl || enviando[para] || typeof RTCPeerConnection === "undefined") return;
        const pc = new RTCPeerConnection(ICE);
        enviando[para] = pc;
        fl.getTracks().forEach(t => pc.addTrack(t, fl));
        pc.onicecandidate = e => { if (e.candidate) senal(para, "ice", e.candidate); };
        pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") avisar("No se pudo conectar el audio con " + para + " (red muy restringida)."); };
        try { const of = await pc.createOffer(); await pc.setLocalDescription(of); senal(para, "offer", pc.localDescription); } catch (e) { }
    }

    async function recibir(m) {
        if (!m || m.para !== yo || typeof m.de !== "string") return;
        try {
            if (m.tipo === "offer") {                          // alguien me ofrece su audio
                if (recibiendo[m.de]) { try { recibiendo[m.de].close(); } catch (e) { } }
                const pc = new RTCPeerConnection(ICE);
                recibiendo[m.de] = pc; if (!Array.isArray(pend[m.de])) pend[m.de] = [];
                pc.onicecandidate = e => { if (e.candidate) senal(m.de, "ice-r", e.candidate); };
                pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") avisar("No llega el audio de " + m.de + " (red muy restringida)."); };
                pc.ontrack = e => {
                    let a = audios[m.de];
                    if (!a) {
                        a = document.createElement("audio"); a.autoplay = true; a.playsInline = true; a.setAttribute("playsinline", ""); a.style.display = "none";
                        document.body.appendChild(a); audios[m.de] = a;       /* en el DOM: los celulares lo tratan mejor */
                    }
                    a.srcObject = e.streams[0]; a.volume = vol;
                    const p = a.play();
                    if (p && p.catch) p.catch(() => { avisar("Toca la pantalla para activar el sonido de " + m.de + "."); desbloquear(); });
                };
                await pc.setRemoteDescription(m.datos);
                (pend[m.de] || []).forEach(c => pc.addIceCandidate(c).catch(() => { })); pend[m.de] = null;
                const resp = await pc.createAnswer(); await pc.setLocalDescription(resp);
                senal(m.de, "answer", pc.localDescription);
            }
            else if (m.tipo === "answer") {
                const pc = enviando[m.de];
                if (pc && !pc.currentRemoteDescription) { await pc.setRemoteDescription(m.datos); (pendEnv[m.de] || []).forEach(c => pc.addIceCandidate(c).catch(() => { })); pendEnv[m.de] = []; }
            }
            else if (m.tipo === "ice") {                        // candidatos del emisor -> mi receptor
                const pc = recibiendo[m.de];
                if (pc && pend[m.de] === null) await pc.addIceCandidate(m.datos);
                else (pend[m.de] = pend[m.de] || []).push(m.datos);
            }
            else if (m.tipo === "ice-r") {
                const pc = enviando[m.de];
                if (pc && pc.remoteDescription) await pc.addIceCandidate(m.datos);
                else (pendEnv[m.de] = pendEnv[m.de] || []).push(m.datos);      /* a\u00fan no llega la respuesta: se guarda y se aplica despu\u00e9s */
            }   // candidatos del receptor -> mi emisor
        } catch (e) { }
    }

    /* Los celulares no dejan sonar un audio nuevo sin un toque: al primer toque se reintenta con todos */
    let esperando = false;
    function desbloquear() {
        if (esperando) return;
        esperando = true;
        const f = () => { esperando = false; Object.keys(audios).forEach(u => { try { const p = audios[u].play(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }); };
        addEventListener("pointerup", f, { once: true, capture: true });
        addEventListener("touchend", f, { once: true, capture: true });
    }

    const cerrarRecepcion = () => {
        Object.keys(recibiendo).forEach(u => { try { recibiendo[u].close(); } catch (e) { } });
        Object.keys(audios).forEach(u => { try { audios[u].pause(); audios[u].srcObject = null; audios[u].remove(); } catch (e) { } delete audios[u]; });
        recibiendo = {}; pend = {};
    };

    return {
        usar(c, usuario) { canal = c; yo = usuario; c.on("senal", recibir); },
        transmitiendo: () => emitiendo,
        emitir(lista) {
            if (emitiendo) return true;
            emitiendo = true;
            if (!flujoLocal()) return false;
            try { if (typeof A !== "undefined" && A.paused && typeof lib !== "undefined" && lib.length && typeof toggle === "function") toggle(); } catch (e) { }
            (lista || []).forEach(u => { if (u && u !== yo) ofrecer(u); });
            return true;
        },
        nuevo(u) { if (emitiendo && u !== yo) ofrecer(u); },
        parar() {
            if (!emitiendo && !Object.keys(enviando).length) return;
            emitiendo = false;
            Object.keys(enviando).forEach(u => { try { enviando[u].close(); } catch (e) { } });
            enviando = {}; Object.keys(pendEnv).forEach(k => delete pendEnv[k]);
            try { if (typeof A !== "undefined" && !A.paused) A.pause(); } catch (e) { }
        },
        cerrar() { this.parar(); cerrarRecepcion(); canal = null; },
        volumen(v) { vol = v; Object.keys(audios).forEach(u => { audios[u].volume = v; }); }
    };
})();

;
/**
 * Online - "Caja de radio" de cada contrincante
 * Cada peleador muestra SU radio (el modelo que tiene puesto, lo que suena y si está reproduciendo).
 * - RadioCaja.crear("A")  -> { d, nom, pt, bt, radio(info) }  caja lista para poner en la tarima
 * - RadioCaja.mi()        -> estado de mi radio ahora mismo { m, t, p }
 * - RadioCaja.escuchar(canal) -> empieza a difundir mi radio cada segundo y a guardar la de los demás
 * - RadioCaja.de(usuario) -> info de la radio de ese usuario
 * Se reproduce con la radio de verdad (el botón ▶ de tu radio); aquí solo se ve y se transmite.
 */
const RadioCaja = (() => {
    const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const otros = {};
    let timer = 0, canalAct = null, yoU = "";

    const imagen = m => { try { return (m && MODELS[m] && MODELS[m].src) || "assets/img/radio-deh-4250bt.jpg"; } catch (e) { return "assets/img/radio-deh-4250bt.jpg"; } };
    const mi = () => {
        let t = "", p = false;
        try { const e = document.getElementById("t3s"); t = (e && e.textContent || "").trim().slice(0, 40); } catch (e) { }
        try { p = !!(typeof A !== "undefined" && A && !A.paused && !A.ended); } catch (e) { }
        return { m: document.body.dataset.m || "orig", t, p };
    };

    function crear(letra) {
        const d = h("div", "btlado btcaja");
        const top = h("div", "btcab2");
        const let_ = h("span", "btletra", letra), nom = h("span", "btnom", "—");
        top.append(let_, nom);
        const rad = h("div", "btradio");
        const img = h("img"); img.alt = "Radio"; img.draggable = false;
        const lcd = h("div", "btlcd"), eq = h("div", "bteq");
        for (let i = 0; i < 5; i++) eq.appendChild(h("i"));
        const tit = h("span", "bttit", "");
        lcd.append(eq, tit);
        const tapa = h("div", "btperilla");          // tapa la perilla del radio de OTRO (la tuya se ve normal)
        rad.append(img, tapa, lcd);
        const pt = h("div", "btpts", ""), bt = h("button", "btb", "Tomar lugar " + letra); bt.type = "button";
        d.append(top, rad, pt, bt);
        let ult = "";
        return {
            d, nom, pt, bt,
            radio(info, mio) {
                if (!info) { tapa.style.display = "none"; rad.classList.add("off"); rad.classList.remove("on"); tit.textContent = "Sin radio"; return; }
                rad.classList.remove("off");
                const s = imagen(info.m); if (ult !== s) { ult = s; img.src = s; }
                rad.classList.toggle("on", !!info.p);
                const k = (MODELS[info.m] || {}).kb;
                if (!mio && k) { tapa.style.cssText = "display:block;left:" + k[0] + "%;top:" + k[1] + "%;width:" + k[2] + "%;height:" + k[3] + "%;background:" + ((MODELS[info.m] || {}).cov || "#0b0e12"); }
                else tapa.style.display = "none";
                tit.textContent = info.p ? (info.t || "♪") : "En pausa";
            }
        };
    }

    function escuchar(canal, yo) {
        parar(); canalAct = canal; yoU = yo || "";
        canal.on("radio", m => { if (m && typeof m.u === "string" && m.u !== yoU) otros[m.u] = { m: String(m.m || "orig").slice(0, 6), t: String(m.t || "").slice(0, 40), p: !!m.p, ts: Date.now() }; });
        const mandar = () => { if (canalAct) { const r = mi(); canalAct.enviar("radio", { u: yoU, m: r.m, t: r.t, p: r.p }); } };
        mandar(); timer = setInterval(mandar, 1000);
    }
    function parar() { clearInterval(timer); timer = 0; canalAct = null; }
    const de = u => {
        if (!u) return null;
        if (u === yoU) return mi();
        const o = otros[u]; return o && Date.now() - o.ts < 6000 ? o : (o ? Object.assign({}, o, { p: false }) : null);
    };
    return { crear, mi, escuchar, parar, de };
})();

;
/**
 * Online - Salas para jugar con AMIGOS
 * - Lobby: salas públicas, crear sala (pública o privada con código) y entrar por código.
 * - Sala libre: chat, la caja de radio de cada persona, y cada quien puede transmitir su radio cuando quiera.
 *   Pueden sonar varios AL MISMO TIEMPO (cada uno oye a todos los que transmiten).
 * - No hay turnos ni tarima de 2: los duelos con juez (A contra B) son solo de los EVENTOS (js/online/evento.js).
 * - Todo viaja por Supabase Realtime (js/online/realtime.js). No hace falta ninguna tabla. Hace falta sesión iniciada.
 */
{
    const MAX_CHAT = 200, MAX_MSGS = 120, MAX_CAJAS = 12;
    const usuario = () => (window.rdApi && window.rdApi.user && window.rdApi.user()) || null;
    const aleatorio = n => { let s = ""; const L = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (let i = 0; i < n; i++) s += L[Math.floor(Math.random() * L.length)]; return s; };
    const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

    let yo = null, lobby = null, sala = null, salaId = "", salaNom = "", ultimoChat = 0, antes = [], emitiendo = false;
    let lider = false;             // el líder (quien creó la sala) puede expulsar
    const baneados = {};           // salaId -> usuarios expulsados (no pueden volver a esa sala en esta sesión)
    const cajas = {};              // usuario -> caja de radio dibujada

    // ---------- pantalla ----------
    const boton = h("button", "btbtn", "⚔️ Batallas"); boton.type = "button"; document.body.appendChild(boton);
    const fondo = h("div", "btm"), caja = h("div", "btc"); fondo.appendChild(caja); document.body.appendChild(fondo);
    const cerrarX = h("button", "btx", "✕"); cerrarX.type = "button"; caja.appendChild(cerrarX);
    const vLobby = h("div", "btv"), vSala = h("div", "btv"); caja.append(vLobby, vSala);

    vLobby.appendChild(h("div", "btt", "⚔️ Salas con amigos"));
    vLobby.appendChild(h("div", "bts", "Entra a una sala o crea la tuya. Pueden sonar todos a la vez si quieren."));
    const lista = h("div", "btlista"); vLobby.appendChild(lista);
    const crear = h("div", "btcrear");
    const inNom = h("input", "btin"); inNom.placeholder = "Nombre de tu sala"; inNom.maxLength = 28;
    const lblPriv = h("label", "btchk"); const chPriv = h("input"); chPriv.type = "checkbox"; lblPriv.append(chPriv, document.createTextNode(" Sala privada (solo con código)"));
    const bCrear = h("button", "btb btp", "Crear sala"); bCrear.type = "button";
    crear.append(inNom, lblPriv, bCrear); vLobby.appendChild(crear);
    const porCodigo = h("div", "btcod");
    const inCod = h("input", "btin"); inCod.placeholder = "Código de sala"; inCod.maxLength = 8;
    const bCod = h("button", "btb", "Entrar con código"); bCod.type = "button";
    porCodigo.append(inCod, bCod); vLobby.appendChild(porCodigo);
    const avisoLobby = h("div", "btaviso", ""); vLobby.appendChild(avisoLobby);

    const cab = h("div", "btcab");
    const salaTitulo = h("div", "btt", ""), salaCodigo = h("div", "btcode", "");
    const bSalir = h("button", "btb", "Salir"); bSalir.type = "button";
    cab.append(salaTitulo, salaCodigo, bSalir);
    const acciones = h("div", "btcod");
    const bTx = h("button", "btb btp", "📡 Transmitir mi radio"); bTx.type = "button";
    const bMiRadio = h("button", "btb", "🎛 Ir a mi radio"); bMiRadio.type = "button";
    acciones.append(bTx, bMiRadio);
    const volFila = h("label", "btvol", "Volumen "); const volIn = h("input"); volIn.type = "range"; volIn.min = 0; volIn.max = 1; volIn.step = .05; volIn.value = 1; volFila.appendChild(volIn);
    const rejilla = h("div", "btrejilla");
    const quienes = h("div", "btquienes", "");
    const chat = h("div", "btchat"), msgs = h("div", "btmsgs"), chatFila = h("div", "btchatf");
    const inChat = h("input", "btin"); inChat.placeholder = "Escribe un mensaje..."; inChat.maxLength = MAX_CHAT;
    const bEnv = h("button", "btb btp", "Enviar"); bEnv.type = "button";
    chatFila.append(inChat, bEnv); chat.append(msgs, chatFila);
    vSala.append(cab, acciones, volFila, rejilla, quienes, chat);

    const verLobby = () => { vLobby.style.display = "block"; vSala.style.display = "none"; };
    const verSala = () => { vLobby.style.display = "none"; vSala.style.display = "block"; };
    const cerrarPanel = () => fondo.classList.remove("on");          // la sala sigue activa en segundo plano
    boton.onclick = () => {
        yo = usuario();
        if (!yo) { if (window.rdApi && window.rdApi.login) window.rdApi.login(); return; }
        fondo.classList.add("on");
        if (!sala) { verLobby(); unirLobby(); } else verSala();
    };
    cerrarX.onclick = cerrarPanel;
    bMiRadio.onclick = cerrarPanel;
    fondo.addEventListener("click", e => { if (e.target === fondo) cerrarPanel(); });

    // ---------- lobby ----------
    function unirLobby() { if (!lobby) lobby = RT.canal("rd-lobby", "l" + aleatorio(6)); lobby.presencia(pintarLobby); pintarLobby(); }
    function pintarLobby() {
        if (!lobby) return;
        const salas = lobby.quien().filter(m => m.sala).map(m => m.sala);
        lista.textContent = "";
        if (!salas.length) { lista.appendChild(h("div", "btvacio", "No hay salas públicas ahora. ¡Crea la primera!")); return; }
        salas.forEach(s => {
            const f = h("div", "btsala");
            f.append(h("b", "", s.nom || "Sala"), h("span", "", " · " + (s.n || 1) + " conectados"));
            const b = h("button", "btb", "Entrar"); b.type = "button"; b.onclick = () => entrar(s.id, false);
            f.appendChild(b); lista.appendChild(f);
        });
    }
    bCrear.onclick = () => entrar(aleatorio(5), true, { nom: (inNom.value || "").trim().slice(0, 28) || ("Sala de " + yo), privada: chPriv.checked });
    bCod.onclick = () => { const c = (inCod.value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length >= 4) entrar(c, false); else avisoLobby.textContent = "Escribe el código de la sala."; };

    // ---------- entrar / salir ----------
    function entrar(id, crea, op) {
        yo = usuario();
        if (!yo) { if (window.rdApi) window.rdApi.login(); return; }
        if (sala) salirSala(false);
        if ((baneados[id] || []).indexOf(yo) >= 0 && !crea) { avisoLobby.textContent = "Te expulsaron de esa sala."; return; }
        salaId = id; antes = []; emitiendo = false; lider = !!crea;
        salaNom = crea ? op.nom : "Sala " + id;
        sala = RT.canal("rd-sala-" + id, yo);
        AV.usar(sala, yo); AV.aviso = t => sumar("btsis", "", t); RadioCaja.escuchar(sala, yo);
        sala.on("chat", recibirChat).on("kick", recibirKick);
        sala.presencia(cambioPresencia);
        sala.track({ u: yo, tx: 0, h: lider ? 1 : 0 });
        salaTitulo.textContent = salaNom; salaCodigo.textContent = "Código: " + id + (crea && op.privada ? " (privada)" : "");
        msgs.textContent = ""; rejilla.textContent = ""; Object.keys(cajas).forEach(k => delete cajas[k]);
        sumar("btsis", "", "Entraste a la sala.");
        bTx.textContent = "📡 Transmitir mi radio";
        verSala();
        if (crea && !op.privada) { unirLobby(); lobby.track({ sala: { id, nom: salaNom, n: 1 } }); }
        pintar();
    }
    function salirSala(mostrarLobby) {
        if (!sala) return;
        if (emitiendo) { AV.parar(); emitiendo = false; }
        AV.cerrar(); RadioCaja.parar();
        if (lobby) lobby.track({});
        try { sala.salir(); } catch (e) { }
        sala = null;
        if (mostrarLobby !== false) { verLobby(); unirLobby(); }
    }
    bSalir.onclick = () => salirSala(true);

    // ---------- transmitir mi radio (varios a la vez) ----------
    bTx.onclick = () => {
        if (!sala) return;
        if (!emitiendo) {
            if (!AV.emitir(sala.quien().map(m => m.u))) { sumar("btsis", "", "No se pudo capturar el audio de tu radio (navegador sin soporte)."); return; }
            emitiendo = true; bTx.textContent = "⏹ Dejar de transmitir";
            sumar("btsis", "", "Estás transmitiendo tu radio. Dale ▶ en tu radio.");
        } else { AV.parar(); emitiendo = false; bTx.textContent = "📡 Transmitir mi radio"; }
        sala.track({ u: yo, tx: emitiendo ? 1 : 0, h: lider ? 1 : 0 });
    };
    volIn.oninput = () => AV.volumen(+volIn.value);

    // ---------- expulsar (solo el l\u00EDder) ----------
    const esLider = u => !!(sala && sala.quien().some(m => m.u === u && m.h));
    function expulsar(u) {
        if (!sala || !lider || u === yo || !confirm("\u00BFExpulsar a " + u + " de la sala?")) return;
        (baneados[salaId] = baneados[salaId] || []).push(u);
        sala.enviar("kick", { por: yo, para: u });
        sumar("btsis", "", "Expulsaste a " + u + ".");
    }
    function recibirKick(m) {
        if (!m || m.para !== yo || !esLider(m.por)) return;       /* solo vale si lo manda el l\u00EDder de la sala */
        const id = salaId; (baneados[id] = baneados[id] || []).push(yo);
        salirSala(true); avisoLobby.textContent = "El l\u00EDder te expuls\u00F3 de la sala.";
    }

    // ---------- presencia ----------
    function cambioPresencia() {
        if (!sala) return;
        const ahora = sala.quien().map(m => m.u).filter(Boolean);
        ahora.filter(u => antes.indexOf(u) < 0 && u !== yo).forEach(u => { sumar("btsis", "", u + " entró."); if (emitiendo) AV.nuevo(u); });
        antes.filter(u => ahora.indexOf(u) < 0).forEach(u => sumar("btsis", "", u + " salió."));
        antes = ahora;
        if (lider) ahora.forEach(u => { if ((baneados[salaId] || []).indexOf(u) >= 0) sala.enviar("kick", { por: yo, para: u }); });
        /* si el l\u00EDder se fue, el primero de la lista (por orden alfab\u00E9tico) pasa a ser el nuevo l\u00EDder */
        if (!lider && ahora.length && !sala.quien().some(m => m.h) && ahora.slice().sort()[0] === yo) { lider = true; sala.track({ u: yo, tx: emitiendo ? 1 : 0, h: 1 }); sumar("btsis", "", "Eres el nuevo l\u00EDder de la sala."); }
        if (lobby && cumpleLobby()) lobby.track({ sala: { id: salaId, nom: salaNom, n: ahora.length } });
        pintar();
    }
    const cumpleLobby = () => !!(sala && lobby && lobby.quien().some(m => m.sala && m.sala.id === salaId && m._k === yo));

    // ---------- chat ----------
    function sumar(cls, quien, texto) {
        const f = h("div", "btmsg " + cls);
        if (quien) f.appendChild(h("b", "", quien + ": "));
        f.appendChild(document.createTextNode(texto)); msgs.appendChild(f);
        while (msgs.children.length > MAX_MSGS) msgs.removeChild(msgs.firstChild);
        msgs.scrollTop = msgs.scrollHeight;
    }
    function recibirChat(m) { if (m && typeof m.t === "string" && typeof m.u === "string") sumar("", m.u.slice(0, 30), m.t.slice(0, MAX_CHAT)); }
    function mandarChat() {
        const t = (inChat.value || "").trim().slice(0, MAX_CHAT);
        if (!t || !sala || Date.now() - ultimoChat < 700) return;
        ultimoChat = Date.now(); sala.enviar("chat", { u: yo, t }); sumar("btyo", yo, t); inChat.value = "";
    }
    bEnv.onclick = mandarChat;
    inChat.addEventListener("keydown", e => { if (e.key === "Enter") mandarChat(); });

    // ---------- cajas de radio de todos ----------
    function pintar() {
        if (!sala) return;
        const miembros = antes.slice(0, MAX_CAJAS);
        Object.keys(cajas).forEach(u => { if (miembros.indexOf(u) < 0) { cajas[u].d.remove(); delete cajas[u]; } });
        miembros.forEach(u => {
            if (!cajas[u]) { const c = RadioCaja.crear(""); c.bt.style.display = "none"; c.d.classList.add("btmini"); c.bt.textContent = "Expulsar"; c.bt.onclick = () => expulsar(u); rejilla.appendChild(c.d); cajas[u] = c; }
            const c = cajas[u], info = RadioCaja.de(u);
            c.nom.textContent = (esLider(u) ? "\uD83D\uDC51 " : "") + (u === yo ? u + " (t\u00FA)" : u);
            c.bt.style.display = lider && u !== yo ? "" : "none";
            c.radio(info, u === yo);
            c.d.classList.toggle("on", !!(info && info.p));
        });
        quienes.textContent = "En la sala (" + antes.length + "): " + antes.join(", ");
    }
    setInterval(() => { if (sala && fondo.classList.contains("on")) pintar(); }, 1000);
}

;
/**
 * Online - EVENTOS VERIFICADOS con JUEZ
 * - Un JUEZ (cuenta con ese rol, lo da un administrador) crea el evento, elige los LUGARES
 *   (Boca Chica, Aguayos, Base Bonao, Andy Ranch... o los que quiera), arma 20+ enfrentamientos (hasta 60),
 *   elige cuál sale a la tarima, quién suena por cada lugar, a quién le toca, y quién ganó cada música.
 * - Al declarar un ganador: ese lugar suma +1 victoria y el otro sale solo de la tarima.
 * - Los resultados viven en Supabase (SQL-BATALLAS.sql) y solo el juez puede cambiarlos: son los verificados.
 * - El chat, quién está conectado y el audio en vivo van por Realtime (igual que las salas de amigos).
 * Las salas de amigos siguen en js/online/batalla.js.
 */
{
    const PRESET = ["Boca Chica", "Aguayos", "Base Bonao", "Andy Ranch"];
    const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const user = () => (window.rdApi && window.rdApi.user && window.rdApi.user()) || null;
    const tok = () => { try { return localStorage.getItem("pioneerToken") || ""; } catch (e) { return ""; } };
    const call = (fn, a) => window.rdApi.rpc(fn, a);
    const aleat = n => { let s = ""; const L = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (let i = 0; i < n; i++) s += L[Math.floor(Math.random() * L.length)]; return s; };

    let yo = null, rol = { juez: false, admin: false }, ev = null, evId = "", canal = null, poll = 0, antes = [], ultimoChat = 0, emit = false;

    // ---------- pantalla ----------
    const boton = h("button", "btbtn evbtn", "🏆 Eventos"); boton.type = "button"; document.body.appendChild(boton);
    const fondo = h("div", "btm"), caja = h("div", "btc"); fondo.appendChild(caja); document.body.appendChild(fondo);
    const x = h("button", "btx", "✕"); x.type = "button"; caja.appendChild(x);
    const vL = h("div", "btv"), vE = h("div", "btv"); caja.append(vL, vE);
    const ver = v => { vL.style.display = v === "l" ? "block" : "none"; vE.style.display = v === "e" ? "block" : "none"; };
    const abrir = async () => {
        yo = user(); if (!yo) { window.rdApi && window.rdApi.login && window.rdApi.login(); return; }
        fondo.classList.add("on");
        if (evId) { ver("e"); return; }
        ver("l"); try { rol = await call("juez_yo", { p_token: tok() }); } catch (e) { rol = { juez: false, admin: false }; }
        lobby();
    };
    boton.onclick = abrir; x.onclick = () => fondo.classList.remove("on");
    fondo.addEventListener("click", e => { if (e.target === fondo) fondo.classList.remove("on"); });

    // ---------- lobby ----------
    async function lobby() {
        vL.textContent = "";
        vL.appendChild(h("div", "btt", "🏆 Eventos verificados"));
        vL.appendChild(h("div", "bts", "Eventos con un juez. Las victorias de cada lugar son oficiales."));
        const lista = h("div", "btlista"); vL.appendChild(lista);
        const av = h("div", "btaviso", ""); vL.appendChild(av);
        try {
            const r = await window.rdApi.rpc("eventos_activos", {});
            if (!r || !r.length) lista.appendChild(h("div", "btvacio", "No hay eventos activos ahora."));
            (r || []).forEach(e => {
                const f = h("div", "btsala");
                f.append(h("b", "", "✔ " + e.nombre), h("span", "", " · juez " + e.juez + " · " + e.hechas + "/" + e.musicas + " músicas"));
                const b = h("button", "btb", "Entrar"); b.type = "button"; b.onclick = () => entrar(e.id); f.appendChild(b); lista.appendChild(f);
            });
        } catch (e) { lista.appendChild(h("div", "btvacio", "No se pudo cargar. Revisa internet y que SQL-BATALLAS.sql esté ejecutado.")); }
        if (rol.juez) {
            const c = h("div", "btcrear");
            const n = h("input", "btin"); n.placeholder = "Nombre del evento"; n.maxLength = 40;
            const m = h("input", "btin"); m.type = "number"; m.min = 1; m.max = 60; m.value = 10; m.title = "Cuántas músicas tiene el evento";
            const b = h("button", "btb btp", "Crear evento (juez)"); b.type = "button";
            b.onclick = async () => {
                try { const r = await call("juez_evento_crear", { p_token: tok(), p_nombre: n.value, p_musicas: +m.value || 10 });
                    await call("juez_evento_lugares", { p_token: tok(), p_evento: r.id, p_lugares: PRESET }); entrar(r.id); }
                catch (e) { av.textContent = "No se pudo crear (nombre de 3+ letras, músicas 1-60)."; }
            };
            c.append(h("div", "bts", "Eres juez. Músicas del evento:"), n, m, b); vL.appendChild(c);
        }
        if (rol.admin) {
            const c = h("div", "btcod"); const n = h("input", "btin"); n.placeholder = "Usuario a hacer juez"; n.maxLength = 20;
            const b = h("button", "btb", "Dar rol de juez"); b.type = "button";
            b.onclick = async () => { try { const r = await call("admin_juez_agregar", { p_token: tok(), p_usuario: n.value }); av.textContent = r && r.error ? "Ese usuario no existe." : "Listo: " + n.value + " ahora es juez."; } catch (e) { av.textContent = "No se pudo."; } };
            const q = h("button", "btb", "Quitar rol"); q.type = "button";
            q.onclick = async () => { try { await call("admin_juez_quitar", { p_token: tok(), p_usuario: n.value }); av.textContent = "Rol quitado."; } catch (e) { av.textContent = "No se pudo."; } };
            c.append(n, b, q); vL.appendChild(c);
        }
    }

    // ---------- entrar al evento ----------
    async function entrar(id) {
        salir(false); evId = id; ev = null; antes = [];
        canal = RT.canal("rd-evento-" + id, yo);
        AV.usar(canal, yo); AV.aviso = t => sumar("btsis", "", t); RadioCaja.escuchar(canal, yo);
        canal.on("chat", m => { if (m && typeof m.t === "string") sumar("", String(m.u).slice(0, 30), m.t.slice(0, 200)); });
        canal.on("refrescar", () => cargar());
        canal.presencia(presencia);
        canal.track({ u: yo });
        armar(); ver("e"); await cargar();
        clearInterval(poll); poll = setInterval(cargar, 4000);
    }
    function salir(lob) {
        if (window.rdLugar) window.rdLugar.temporal(null);
        clearInterval(poll); if (emit) { AV.parar(); emit = false; }
        if (canal) { try { RadioCaja.parar(); AV.cerrar(); canal.salir(); } catch (e) { } }
        canal = null; evId = ""; ev = null;
        if (lob) { ver("l"); lobby(); }
    }
    const esJuez = () => ev && (ev.juez === yo || rol.admin);
    const quien = () => (canal ? canal.quien().map(m => m.u).filter(Boolean) : []);
    setInterval(() => { if (evId && ev && fondo.classList.contains("on")) pintar(); }, 1500);
    function presencia() {
        const ahora = quien();
        ahora.filter(u => antes.indexOf(u) < 0 && u !== yo).forEach(u => { sumar("btsis", "", u + " entró."); if (emit) AV.nuevo(u); });
        antes.filter(u => ahora.indexOf(u) < 0).forEach(u => sumar("btsis", "", u + " salió."));
        antes = ahora; pintar();
    }

    // ---------- armazón ----------
    let eTitulo, eEstado, eTarima, eMarcador, ePanel, eMsgs, eInChat, eQuienes, eLista;
    function armar() {
        vE.textContent = "";
        const cab = h("div", "btcab"); eTitulo = h("div", "btt", ""); const bs = h("button", "btb", "Salir"); bs.type = "button"; bs.onclick = () => salir(true);
        cab.append(eTitulo, bs);
        eEstado = h("div", "btfase", ""); eTarima = h("div", "bttarima"); eMarcador = h("div", "btquienes", ""); ePanel = h("div", "btcrear"); eLista = h("div", "btlista");
        eQuienes = h("div", "btquienes", "");
        const ch = h("div", "btchat"); eMsgs = h("div", "btmsgs"); const f = h("div", "btchatf");
        eInChat = h("input", "btin"); eInChat.placeholder = "Escribe un mensaje..."; eInChat.maxLength = 200;
        const be = h("button", "btb btp", "Enviar"); be.type = "button";
        const mandar = () => { const t = (eInChat.value || "").trim(); if (!t || !canal || Date.now() - ultimoChat < 700) return; ultimoChat = Date.now(); canal.enviar("chat", { u: yo, t }); sumar("btyo", yo, t); eInChat.value = ""; };
        be.onclick = mandar; eInChat.addEventListener("keydown", e => { if (e.key === "Enter") mandar(); });
        const vol = h("label", "btvol", "Volumen "); const vi = h("input"); vi.type = "range"; vi.min = 0; vi.max = 1; vi.step = .05; vi.value = 1; vi.oninput = () => AV.volumen(+vi.value); vol.appendChild(vi);
        f.append(eInChat, be); ch.append(eMsgs, f);
        vE.append(cab, eEstado, eTarima, eMarcador, ePanel, eLista, eQuienes, vol, ch);
    }
    function sumar(cls, q, t) { if (!eMsgs) return; const f = h("div", "btmsg " + cls); if (q) f.appendChild(h("b", "", q + ": ")); f.appendChild(document.createTextNode(t)); eMsgs.appendChild(f); while (eMsgs.children.length > 120) eMsgs.removeChild(eMsgs.firstChild); eMsgs.scrollTop = eMsgs.scrollHeight; }

    // ---------- datos ----------
    async function cargar() {
        if (!evId) return;
        try { const r = await window.rdApi.rpc("evento_estado", { p_evento: evId }); if (r && !r.error) { ev = r; pintar(); audio(); } else if (r && r.error) { eEstado.textContent = "Ese evento ya no existe."; } } catch (e) { }
    }
    // el juez ejecuta una acción y avisa a todos que refresquen
    async function accion(fn, a) {
        try { const r = await call(fn, Object.assign({ p_token: tok(), p_evento: evId }, a)); if (canal) canal.enviar("refrescar", {}); await cargar(); return r; }
        catch (e) { eEstado.textContent = "No se pudo (¿sesión o permisos?)."; }
    }
    const parActual = () => ev && ev.pares.find(p => p.id === ev.par_actual);

    // mi audio: suena quien el juez eligió para el turno actual
    function audio() {
        const p = parActual();
        const mio = !!(p && (((p.turno === "A" || p.turno === "AB") && p.ra === yo) || ((p.turno === "B" || p.turno === "AB") && p.rb === yo)));
        if (mio && !emit) { emit = AV.emitir(quien()); }
        else if (!mio && emit) { AV.parar(); emit = false; }
    }

    // ---------- pintar ----------
    function pintar() {
        if (!ev) return;
        eTitulo.textContent = "✔ " + ev.nombre + " · juez " + ev.juez;
        const hechas = ev.pares.filter(p => p.estado === "hecho").length;
        eEstado.textContent = ev.estado === "activo" ? "Música " + Math.min(hechas + 1, ev.musicas) + " de " + ev.musicas : (ev.estado === "finalizado" ? "🏁 Evento finalizado" : "Evento cerrado");
        // el LUGAR de la tarima cambia el fondo de la página (no es una caja)
        if (window.rdLugar) window.rdLugar.temporal(parActual() ? parActual().lugar : "");
        // tarima
        eTarima.textContent = "";
        const p = parActual();
        const lado = (L, lug, rep, wins) => {
            const c = RadioCaja.crear(L); c.bt.style.display = "none";
            c.d.classList.toggle("on", !!(p && (p.turno === L || p.turno === "AB")));
            c.nom.textContent = lug || "\u2014";
            c.pt.textContent = (rep ? "\uD83C\uDFA7 " + rep : "Sin m\u00FAsico") + " \u00B7 Victorias: " + (wins || 0);
            c.radio(rep ? RadioCaja.de(rep) : null, rep === yo);
            return c.d;
        };
        const w = n => { const q = (ev.participantes.find(l => l.nombre === n) || {}); return q ? q.wins : 0; };
        if (p) {
            const c = h("div", "btcentro"); const sue = p.turno === "A" ? p.a : p.b, soy = p.turno === "AB" ? (p.ra === yo || p.rb === yo) : (p.turno === "A" ? p.ra === yo : p.rb === yo);
            const modo = p.modo === "freakeo" ? "\uD83D\uDD25 FREAKEO (suenan los dos a la vez)" : "\uD83C\uDFA7 CALIDAD \u00B7 tema " + Math.min(p.tema || 0, 5) + "/5";
            c.appendChild(h("div", "btfase", modo));
            c.appendChild(h("div", "btfase", p.turno === "AB" ? "Suenan los dos" + (soy ? " \u2014 \u00A1dale \u25B6 a tu radio!" : "") : (p.turno ? "Suena " + sue + (soy ? " \u2014 \u00A1dale \u25B6 a tu radio!" : "") : "En tarima")));
            eTarima.append(lado("A", p.a, p.ra, w(p.a)), lado("B", p.b, p.rb, w(p.b)), c);
        } else eTarima.appendChild(h("div", "btvacio", ev.estado === "activo" ? "No hay nadie en la tarima." : ""));
        // marcador
        eMarcador.textContent = "Marcador: " + ev.participantes.map(l => l.nombre + " " + l.wins).join(" · ");
        // panel del juez
        ePanel.textContent = "";
        if (esJuez() && ev.estado === "activo") panelJuez(p);
        listaPares(p);
        eQuienes.textContent = "Conectados (" + antes.length + "): " + antes.join(", ");
    }
    function sel(opts, val, vacio) { const s = h("select", "btin"); const o0 = h("option", "", vacio); o0.value = ""; s.appendChild(o0); opts.forEach(o => { const op = h("option", "", o); op.value = o; if (o === val) op.selected = true; s.appendChild(op); }); return s; }
    function btn(t, fn, cls) { const b = h("button", "btb" + (cls ? " " + cls : ""), t); b.type = "button"; b.onclick = fn; return b; }

    function panelJuez(p) {
        ePanel.appendChild(h("div", "bts", "Panel del juez"));
        if (p) {
            const us = quien();
            const sa = sel(us, p.ra, "Quién suena por " + p.a), sb = sel(us, p.rb, "Quién suena por " + p.b);
            sa.onchange = sb.onchange = () => accion("juez_par_reps", { p_par: p.id, p_ra: sa.value, p_rb: sb.value });
            ePanel.append(sa, sb);
            const sl = sel(ev.lugares, p.lugar, "Sin lugar (fondo normal)"); sl.onchange = () => accion("juez_par_lugar", { p_par: p.id, p_lugar: sl.value });
            ePanel.appendChild(sl);
            const mo = h("div", "btcod");
            mo.append(btn((p.modo === "calidad" ? "\u2714 " : "") + "Calidad (5 temas)", () => accion("juez_par_modo", { p_par: p.id, p_modo: "calidad" })), btn((p.modo === "freakeo" ? "\u2714 " : "") + "Freakeo (a la vez)", () => accion("juez_par_modo", { p_par: p.id, p_modo: "freakeo" })));
            ePanel.appendChild(mo);
            const f = h("div", "btcod");
            const nadie = btn("\u23F8 Nadie", () => accion("juez_par_turno", { p_par: p.id, p_turno: "" }));
            if (p.modo === "freakeo") f.append(btn("\u25B6 Suenan los dos", () => accion("juez_par_turno", { p_par: p.id, p_turno: "AB" }), "btp"), nadie);
            else f.append(btn("\u25B6 Suena " + p.a, () => accion("juez_par_turno", { p_par: p.id, p_turno: "A" }), "btp"), btn("\u25B6 Suena " + p.b, () => accion("juez_par_turno", { p_par: p.id, p_turno: "B" }), "btp"), nadie);
            ePanel.appendChild(f);
            if (p.modo !== "freakeo") ePanel.appendChild(btn("Tema siguiente (" + Math.min(p.tema || 0, 5) + "/5)", () => accion("juez_par_tema", { p_par: p.id, p_tema: (p.tema || 0) + 1 })));
            const g = h("div", "btcod");
            g.append(btn("🏆 Gana " + p.a, () => ganar(p, p.a), "btp"), btn("🏆 Gana " + p.b, () => ganar(p, p.b), "btp"));
            ePanel.appendChild(g);
        }
        // lugares
        const lg = h("div", "btcod"); const nl = h("input", "btin"); nl.placeholder = "Nuevo lugar"; nl.maxLength = 30;
        lg.append(nl, btn("Añadir lugar", () => { if (nl.value.trim()) accion("juez_evento_lugares", { p_lugares: [nl.value.trim()] }); }));
        ePanel.appendChild(lg);
        // enfrentamientos
        const fp = h("div", "btcod");
        const ia = h("input", "btin"); ia.placeholder = "Contrincante A"; ia.maxLength = 30;
        const ib = h("input", "btin"); ib.placeholder = "Contrincante B"; ib.maxLength = 30;
        const pl = sel(ev.lugares, "", "Lugar (fondo)");
        fp.append(ia, ib, pl, btn("A\u00F1adir enfrentamiento", () => { const a = ia.value.trim(), b2 = ib.value.trim(); if (a && b2 && a !== b2) accion("juez_evento_pares", { p_pares: [{ a, b: b2, lugar: pl.value }] }); }));
        ePanel.appendChild(fp);
        ePanel.appendChild(btn("Cerrar evento", () => { if (confirm("¿Cerrar el evento?")) accion("juez_evento_cerrar", {}); }));
    }
    async function ganar(p, lugar) {
        if (!confirm("¿Declarar ganador a " + lugar + "? Suma +1 victoria y el otro sale de la tarima.")) return;
        await accion("juez_par_ganador", { p_par: p.id, p_ganador: lugar });
        const r = ev; if (r && r.estado !== "activo") sumar("btsis", "", "🏁 Evento terminado.");
    }

    function listaPares(actual) {
        eLista.textContent = "";
        eLista.appendChild(h("div", "bts", "Enfrentamientos (" + ev.pares.length + ")"));
        ev.pares.forEach(p => {
            const f = h("div", "btsala" + (actual && actual.id === p.id ? " on" : ""));
            const est = p.estado === "hecho" ? " → ganó " + p.ganador : (p.estado === "en_curso" ? " · EN TARIMA" : "");
            f.appendChild(h("span", "", "#" + p.orden + " " + p.a + " vs " + p.b + (p.lugar ? " \u00B7 " + p.lugar : "") + est));
            if (esJuez() && ev.estado === "activo" && p.estado !== "hecho") {
                if (!actual || actual.id !== p.id) f.appendChild(btn("A la tarima", () => accion("juez_par_poner", { p_par: p.id })));
                if (p.estado === "pendiente") f.appendChild(btn("Quitar", () => accion("juez_par_quitar", { p_par: p.id })));
            }
            eLista.appendChild(f);
        });
    }
    window.rdEventos = { abrir };
}

;
/**
 * DEH CD Bluetooth (PRS-80) - Pantalla LCD
 * - Fondo con rayos de luz animados y los textos del radio real (CD, FLD/TRK, kbps, título, tiempo, PLAY, voltaje).
 * - Lista en dos niveles: botón LIST/ENTER -> carpetas -> pistas de la carpeta -> reproducir.
 * Solo actúa cuando el modelo activo es "m2" (body[data-m=m2]). Estilos: sección "DEH CD Bluetooth" de styles.css.
 */

{
    const dsp = $("dsp"), cara = $("face");
    if (dsp && cara) {
        // --- 1. Piezas de la pantalla: fondo con rayos de luz + textos como el original ---
        const lcd = document.createElement("div");
        lcd.className = "prl";
        lcd.innerHTML =
            '<canvas class="prcv" width="310" height="80"></canvas>' +
            '<div class="prm">' +
              '<span class="prcdl">CD</span>' +
              '<span class="prtr"><b id="prfl"></b><br><i>192kbps</i></span>' +
              '<span class="prcd"></span>' +
              '<span class="prti"><span id="prtt"></span></span>' +
              '<span class="prtm" id="prtm"></span>' +
              '<span class="prpl" id="prpl"></span>' +
              '<span class="prpb"><b id="prpf"></b></span>' +
              '<span class="prv" id="prv"></span>' +
            '</div>' +
            '<div class="prls" id="prls"></div>';
        dsp.insertBefore(lcd, dsp.firstChild);
        const q = id => document.getElementById(id);
        const cv = lcd.querySelector(".prcv"), cx = cv.getContext ? cv.getContext("2d") : null;
        let playing = false, ultimoTitulo = "";

        // Rayos de luz que se cruzan y se desvanecen (como el visualizador real)
        const rayos = () => {
            if (!cx) return;
            cx.globalCompositeOperation = "destination-out";
            cx.fillStyle = "rgba(0,0,0," + (playing ? ".2" : ".12") + ")";
            cx.fillRect(0, 0, 310, 80);
            cx.globalCompositeOperation = "source-over";
            const f = playing ? 1 : .55;                         // en pausa: menos intensos pero siguen
            const n = Math.round((4 + Math.random() * 4) * f);
            for (let i = 0; i < n; i++) {                        // rayos que cruzan la pantalla
                const x = Math.random() * 310, y = Math.random() * 80, ang = Math.random() * Math.PI * 2, L = 60 + Math.random() * 220;
                cx.strokeStyle = "rgba(255,255,255," + (0.35 + Math.random() * 0.6) * f + ")";
                cx.lineWidth = Math.random() < .3 ? 2 : 1;
                cx.beginPath(); cx.moveTo(x, y);
                const mx = x + Math.cos(ang) * L / 2 + (Math.random() - .5) * 16, my = y + Math.sin(ang) * L / 2 + (Math.random() - .5) * 16;
                cx.lineTo(mx, my); cx.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L);
                cx.stroke();
            }
            if (Math.random() < .7) {                            // línea de onda horizontal
                const y = 10 + Math.random() * 60;
                cx.strokeStyle = "rgba(255,255,255," + (0.3 + Math.random() * .4) * f + ")";
                cx.lineWidth = 1; cx.beginPath(); cx.moveTo(0, y);
                for (let x = 0; x <= 310; x += 6) cx.lineTo(x, y + (Math.random() - .5) * (playing ? 9 : 3));
                cx.stroke();
            }
            for (let i = 0; i < 22; i++) {                       // chispas sueltas
                cx.fillStyle = "rgba(255,255,255," + Math.random() * .8 * f + ")";
                cx.fillRect(Math.random() * 310, Math.random() * 80, 1.6, 1.6);
            }
        };
        let ult = 0;
        const bucle = t => {
            if (t - ult > 55) { ult = t; if (document.body.dataset.m === "m2") rayos(); }
            requestAnimationFrame(bucle);
        };
        if (window.requestAnimationFrame) requestAnimationFrame(bucle);

        // --- 2. Lista en dos niveles: 1 = carpetas, 2 = pistas de la carpeta elegida ---
        let nivel = 0, fSel = 0, fT = 0;
        const esM2 = () => document.body.dataset.m === "m2" && on && lib.length > 0;
        const mover = d => { fSel = (fSel + d + lib.length) % lib.length; fT = Date.now(); };
        const _listN = listN, _vol = vol, _chPl = chPl, _prev = prev, _next = next, _confirm = confirmList;

        // Botón LIST / ENTER: normal → carpetas → pistas de esa carpeta → reproducir
        listN = function () {
            if (!esM2()) return _listN();
            if (nivel === 0) { nivel = 1; fSel = p; fT = Date.now(); listMode = false; render(); }
            else if (nivel === 1) {              // elegir carpeta → mostrar su lista de música
                p = fSel; t = 0; lt = 0; nivel = 2;
                if (!listMode) _listN();
                listMode = true; lt = 0; render();
            }
            else { _confirm(); nivel = 0; }       // elegir canción → reproducir
        };
        // Mientras se ve la lista de carpetas, perilla / ▲▼ / ◀▶ mueven la selección
        vol = function (d) { if (esM2() && nivel === 1) { mover(d); return; } return _vol(d); };
        chPl = function (d) { if (esM2() && nivel === 1) { mover(d); return; } nivel = 0; return _chPl(d); };
        prev = function () { if (esM2() && nivel === 1) { mover(-1); return; } return _prev(); };
        next = function () { if (esM2() && nivel === 1) { mover(1); return; } return _next(); };
        confirmList = function () { if (esM2() && nivel === 1) return listN(); return _confirm(); };

        // --- 3. Texto de la pantalla (se refresca varias veces por segundo) ---
        const mmss = s => isFinite(s) ? pad(Math.floor(s / 60)) + "'" + pad(Math.floor(s % 60)) + '"' : "00'00\"";
        const pintar = () => {
            if (document.body.dataset.m !== "m2") return;
            let suena = false, pct = 0, ct = 0;
            try {
                suena = on && !A.paused && !!A.getAttribute("src");
                ct = A.currentTime || 0;
                pct = A.duration ? ct / A.duration : 0;
            } catch (e) { }
            playing = suena;
            const tiene = typeof lib !== "undefined" && lib.length > 0;
            // --- modo lista: 3 filas con la seleccionada resaltada ---
            const ls = q("prls");
            if (nivel === 1 && Date.now() - fT > 8000) nivel = 0;       // se cierra sola
            if (nivel === 2 && !listMode) nivel = 0;
            if (!tiene) nivel = 0;
            lcd.classList.toggle("lista", nivel > 0);
            if (nivel > 0) {
                const carp = nivel === 1, items = carp ? lib : lib[p].tracks, sel = carp ? fSel : lt, n = items.length;
                const ini = Math.max(0, Math.min(n - 3, sel - 1));
                let h = "";
                for (let i = ini; i < Math.min(n, ini + 3); i++) {
                    const nom = (carp ? items[i].name : items[i].title) || "";
                    h += '<div class="prfila' + (i === sel ? " sel" : "") + '"><em>' + pad(i + 1) + "</em>" + (carp ? "\uD83D\uDCC1 " : "\u266A ") + nom.toUpperCase().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") + "</div>";
                }
                if (ls._h !== h) { ls.innerHTML = h; ls._h = h; }
                return;
            }
            // --- modo normal ---
            q("prfl").textContent = "FLD" + pad(tiene ? p + 1 : 0) + "TRK" + pad(tiene ? t + 1 : 0);
            const titulo = $("t3s").textContent || "";       // ya trae avisos (VOL, NO PHONE...) y "ELEGIR CARPETA"
            if (titulo !== ultimoTitulo) {
                ultimoTitulo = titulo;
                const sp = q("prtt");
                sp.textContent = "\u266A " + titulo;
                sp.className = titulo.length > 13 ? "sc" : "";
            }
            q("prtm").textContent = tiene ? mmss(ct) : "";
            q("prpl").textContent = suena ? "\u25B6PLAY" : "\u275A\u275APAUSE";
            q("prpf").style.width = Math.round(pct * 100) + "%";
            let vv = 12.6; try { vv = vmBase; } catch (e) { }
            q("prv").textContent = vv.toFixed(1) + "v";
        };
        setInterval(pintar, 200);
        pintar();
    }
}

;
/**
 * DEH CD Bluetooth (PRS-80) - Palanquitas ◀ ▶ de la perilla
 * Al cambiar de música la palanquita (las dos "alas" a los lados de la perilla) se mueve EN CONJUNTO, como un balancín:
 *   ◀ anterior -> baja el lado izquierdo y sube el derecho   ·   ▶ siguiente -> al revés.
 * Funciona con los botones del radio, el control remoto y el teclado (se engancha a prev() y next()).
 * También los botones redondos junto a la pantalla (carpeta ▲ / ▼) se hunden al pulsarlos.
 * Solo actúa con el modelo "m2" (body[data-m=m2]).
 */

{
    const cara = $("face");
    if (cara) {
        const esM2 = () => document.body.dataset.m === "m2";
        let tw = 0;

        // --- Palanquita en conjunto (como en el video): las dos alas giran juntas, como un balancín ---
        // Al pulsar ◀ (anterior) el lado izquierdo baja y el derecho sube; al pulsar ▶ (siguiente) al revés.
        // Cada ala es una copia del trozo de la imagen del radio que gira alrededor del centro de la perilla.
        const crearAla = (titulo, giro, cx, cy) => {
            const zona = [...cara.querySelectorAll("button.gen")].find(b => b.title === titulo);
            const img = document.querySelector("#face img.bg");
            if (!zona || !img) return null;
            const L = parseFloat(zona.style.left), W = parseFloat(zona.style.width);
            // se amplía un poco hacia arriba y abajo para que la copia tape por completo el ala original al girar
            const H0 = parseFloat(zona.style.height), T = parseFloat(zona.style.top) - H0 * 0.2, H = H0 * 1.4;
            const ala = document.createElement("div");
            ala.className = "prala " + giro;
            ala.style.cssText = "left:" + L + "%;top:" + T + "%;width:" + W + "%;height:" + H + "%;" +
                "background-image:url(" + img.getAttribute("src") + ");" +
                "background-size:" + (10000 / W) + "% " + (10000 / H) + "%;" +
                "background-position:" + (L / (100 - W) * 100) + "% " + (T / (100 - H) * 100) + "%;" +
                "transform-origin:" + ((cx - L) / W * 100) + "% " + ((cy - T) / H * 100) + "%";
            cara.appendChild(ala);
            return ala;
        };
        const bajarAla = titulo => {
            if (!esM2()) return;
            const kb = $("kb");
            if (!kb) return;
            // centro de la perilla (en % de la cara)
            const cx = parseFloat(kb.style.left) + parseFloat(kb.style.width) / 2, cy = parseFloat(kb.style.top) + parseFloat(kb.style.height) / 2;
            cara.querySelectorAll(".prala").forEach(e => e.remove());
            const ant = titulo === "Anterior";       // anterior: gira hacia la izquierda; siguiente: hacia la derecha
            const g = ant ? "prgi" : "prgd";
            const a1 = crearAla("Anterior", g, cx, cy), a2 = crearAla("Siguiente", g, cx, cy);
            clearTimeout(tw); tw = setTimeout(() => { if (a1) a1.remove(); if (a2) a2.remove(); }, 360);
        };
        window.prsAla = bajarAla;

        // Cualquier cambio de pista (botón, control remoto, teclado) baja la palanquita correspondiente
        const _prev = prev, _next = next;
        prev = function () { bajarAla("Anterior"); return _prev(); };
        next = function () { bajarAla("Siguiente"); return _next(); };

        // --- Botones redondos de carpeta: se hunden al pulsarlos (también desde el control remoto) ---
        let tp = 0;
        window.prsPalanca = (arriba, btn) => {
            if (!btn) return;
            btn.classList.remove("prup", "prdn"); void btn.offsetWidth;
            btn.classList.add(arriba ? "prup" : "prdn");
            clearTimeout(tp); tp = setTimeout(() => btn.classList.remove("prup", "prdn"), 260);
        };
        cara.addEventListener("click", e => {
            if (!esM2()) return;
            const b = e.target.closest ? e.target.closest("button.gen") : null;
            if (!b) return;
            if (b.title === "Carpeta anterior") window.prsPalanca(true, b);
            else if (b.title === "Carpeta siguiente") window.prsPalanca(false, b);
        });
    }
}

;
/**
 * DEH CD Bluetooth (PRS-80) - Control remoto
 * Mando negro tipo Pioneer CD-R320 dibujado igual al real (medidas tomadas de la foto).
 * Botón "Control" (abajo a la derecha) abre el mando flotante; se arrastra desde la barra "mover".
 * Cada tecla llama a las mismas funciones que los botones de la radio.
 * Solo aparece con el modelo "m2" (body[data-m=m2]).
 */

{
    const body = document.body;
    const ESCALA = 0.4;                 // tamaño en pantalla (el mando se dibuja en 443 x 807 y se reduce)
    const ANCHO = 443, ALTO = 807;

    // Volumen: igual que los botones VOL de la página (la radio los lee con "pointerdown", no con clic).
    // Al mantener pulsado se repite.
    const volumen = d => { try { vol(d); } catch (e) { } };
    const conRepeticion = (b, d) => {
        let t1, t2;
        const parar = () => { clearTimeout(t1); clearInterval(t2); };
        b.onclick = null;
        b.addEventListener("pointerdown", e => { e.preventDefault(); volumen(d); t1 = setTimeout(() => { t2 = setInterval(() => volumen(d), 110); }, 400); });
        ["pointerup", "pointerleave", "pointercancel"].forEach(n => b.addEventListener(n, parar));
    };
    const el = (t, c, x) => { const e = document.createElement(t); e.className = c; if (x != null) e.innerHTML = x; return e; };

    // Coloca un elemento en el espacio de dibujo (x, y, ancho, alto en píxeles de 443 x 807)
    const poner = (e, x, y, w, h) => {
        e.style.left = x + "px"; e.style.top = y + "px";
        if (w != null) { e.style.width = w + "px"; e.style.height = h + "px"; }
        return e;
    };
    // Rótulo blanco centrado en (cx, cy)
    const rotulo = (txt, cx, cy, cls) => {
        const e = el("span", "rkt " + (cls || ""), txt);
        e.style.left = cx + "px"; e.style.top = cy + "px";
        return e;
    };

    // --- armado del mando ---
    const mando = el("div", "rkbody");
    const cab = el("div", "rkhead", "✥ mover");
    const marco = el("div", "rkmarco");
    marco.style.width = (ANCHO * ESCALA) + "px";
    marco.style.height = (ALTO * ESCALA) + "px";
    const dib = el("div", "rkdib");              // lienzo de 443 x 807 (se reduce con transform)
    dib.style.width = ANCHO + "px"; dib.style.height = ALTO + "px";
    dib.style.transform = dib.style.webkitTransform = "scale(" + ESCALA + ")";
    marco.appendChild(dib);
    mando.append(cab, marco);

    // Tecla gris: rectangular o redonda
    const tecla = (x, y, w, h, cls, fn, txt) => {
        const b = el("button", "rk " + cls, txt || "");
        b.type = "button";
        b.onclick = () => { try { fn(); } catch (e) { } };
        return dib.appendChild(poner(b, x, y, w, h));
    };
    const redonda = (cx, cy, r, cls, fn, txt) => tecla(cx - r, cy - r, 2 * r, 2 * r, "rkr " + (cls || ""), fn, txt);

    // 1. VOLUME: placa plateada con − y +, y los dos botones grandes en los extremos
    dib.appendChild(poner(el("div", "rkplaca rkvol"), 50, 90, 343, 87));
    dib.appendChild(rotulo("− &nbsp;VOLUME&nbsp; +", 221, 134, "rkvt"));
    conRepeticion(tecla(56, 96, 74, 72, "rkv rkvl", () => { }), -1);
    conRepeticion(tecla(314, 96, 74, 72, "rkv rkvr", () => { }), 1);

    // 2. BAND/ESC y MUTE
    dib.appendChild(rotulo("BAND/ESC", 93, 199));
    tecla(53, 224, 75, 45, "rkc", () => restart());
    dib.appendChild(rotulo("MUTE", 349, 199));
    redonda(349, 247, 35, "", () => mute());

    // 3. Cruceta: placa plateada en forma de cruz con 5 teclas
    const cruz = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    cruz.setAttribute("class", "rkcruz");
    cruz.setAttribute("viewBox", "0 0 " + ANCHO + " " + ALTO);
    cruz.innerHTML =
        '<g fill="#cfcfd2" stroke="#0e0e10" stroke-width="6" stroke-linejoin="round">' +
        '<rect x="174" y="217" width="89" height="265" rx="20"/><rect x="46" y="317" width="347" height="85" rx="20"/></g>' +
        '<g fill="#cfcfd2"><rect x="177" y="220" width="83" height="259" rx="17"/><rect x="49" y="320" width="341" height="79" rx="17"/></g>';
    dib.appendChild(cruz);
    dib.appendChild(rotulo("▲", 221, 289, "rkn"));
    dib.appendChild(rotulo("◀", 146, 347, "rkn"));
    dib.appendChild(rotulo("▶", 288, 347, "rkn"));
    dib.appendChild(rotulo("▼", 221, 409, "rkn"));
    dib.appendChild(rotulo("LIST/ENTER", 221, 311, "rkn rkp rkli"));
    dib.appendChild(rotulo("DISC/P.CH ▲▼", 112, 303, "rkp"));
    dib.appendChild(rotulo("◀▶ TRACK/SEEK", 350, 303, "rkp"));
    tecla(183, 222, 73, 48, "rkc", () => chPl(-1), "");   // arriba: carpeta anterior
    tecla(51, 324, 77, 48, "rkc", () => prev());           // izquierda: pista anterior
    tecla(183, 324, 75, 48, "rkc", () => listN());         // centro: LIST/ENTER
    tecla(311, 324, 75, 48, "rkc", () => next());          // derecha: pista siguiente
    tecla(183, 430, 73, 49, "rkc", () => chPl(1));         // abajo: carpeta siguiente

    // 4. FUNCTION y AUDIO
    dib.appendChild(rotulo("FUNCTION", 89, 416));
    tecla(51, 432, 74, 42, "rkc", () => band());
    dib.appendChild(rotulo("AUDIO", 348, 418));
    tecla(313, 434, 72, 42, "rkc", () => eq());

    // 5. SRC (con aro blanco), pausa y DISP
    dib.appendChild(rotulo("SRC", 88, 503));
    redonda(86, 575, 45, "rkaro", () => power());
    dib.appendChild(rotulo("❚❚", 218, 510, "rkpa"));
    redonda(218, 577, 35, "", () => toggle());
    dib.appendChild(rotulo("DISP", 348, 508));
    redonda(348, 577, 35, "", () => dmode());
    dib.appendChild(rotulo("↔ SCRL", 348, 629, "rkp"));

    dib.appendChild(rotulo("REMOTE CONTROLLER", 215, 745, "rkrc"));
    document.body.appendChild(mando);

    // --- botón que abre el mando ---
    const abrir = el("button", "rkopen", "🎛 Control");
    abrir.type = "button";
    document.body.appendChild(abrir);
    abrir.onclick = () => mando.classList.toggle("open");
    const pintar = () => { body.classList.toggle("rk-ok", body.dataset.m === "m2"); if (body.dataset.m !== "m2") mando.classList.remove("open"); };
    new MutationObserver(pintar).observe(body, { attributes: true, attributeFilter: ["data-m"] });
    pintar();

    // --- arrastrar el mando por la barra "mover" ---
    let ar = false, sx = 0, sy = 0, ox = 0, oy = 0;
    const pt = e => (e.touches && e.touches[0]) ? e.touches[0] : e;
    const ini = e => { const p = pt(e), r = mando.getBoundingClientRect(); ar = true; sx = p.clientX; sy = p.clientY; ox = r.left; oy = r.top; e.preventDefault(); };
    const mov = e => {
        if (!ar) return;
        const p = pt(e);
        mando.style.left = Math.max(0, Math.min(innerWidth - 60, ox + p.clientX - sx)) + "px";
        mando.style.top = Math.max(0, Math.min(innerHeight - 40, oy + p.clientY - sy)) + "px";
        mando.style.right = "auto"; mando.style.bottom = "auto";
        e.preventDefault();
    };
    ["mousedown", "touchstart"].forEach(n => cab.addEventListener(n, ini));
    ["mousemove", "touchmove"].forEach(n => document.addEventListener(n, mov, { passive: false }));
    ["mouseup", "touchend", "touchcancel"].forEach(n => document.addEventListener(n, () => { ar = false; }));
}

;
/**
 * Compatibilidad con navegadores y celulares viejos
 *  1. Si no existen las unidades "cqw" (Chrome<105, Safari<16, Firefox<110...), calcula --cq (1% del ancho de cada contenedor)
 *     para que el respaldo de styles.css (generado en herramientas/construir.js) dibuje el radio igual.
 *  2. Si falta algo imprescindible (audio, Promise, fetch...), avisa con un mensaje claro en vez de mostrar la pagina rota.
 */
(function () {
    var CONT = ".face,.stack,.eqp,.case,#dsp,.atp,.crp,.prp";
    function sinCqw() { try { return !(window.CSS && CSS.supports && CSS.supports("width", "1cqw")); } catch (e) { return true; } }
    function medir() {
        var l = document.querySelectorAll(CONT);
        for (var i = 0; i < l.length; i++) {
            var w = l[i].clientWidth;
            if (w) l[i].style.setProperty("--cq", (w / 100) + "px");
        }
    }
    if (sinCqw()) {
        document.documentElement.className += " sin-cqw";
        medir();
        addEventListener("resize", medir);
        addEventListener("load", medir);
        setInterval(medir, 700);   /* tambien cubre equipos que se agregan despues */
    }
    var falta = [];
    if (!(window.AudioContext || window.webkitAudioContext)) falta.push("audio (Web Audio)");
    if (!window.Promise) falta.push("Promise");
    if (!window.fetch) falta.push("fetch");
    if (!document.querySelector) falta.push("querySelector");
    if (falta.length) {
        var d = document.createElement("div");
        d.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99999;padding:12px 16px;background:#7a1620;color:#fff;font:14px Arial,sans-serif;text-align:center";
        d.textContent = "Tu navegador es muy viejo y no soporta: " + falta.join(", ") + ". Actualízalo o abre la página en Chrome, Edge, Firefox o Safari recientes.";
        (document.body || document.documentElement).appendChild(d);
    }
})();

;
/**
 * Arranque
 * Primer render e inicio de la biblioteca de música.
 */

render();
init();

;
/**
 * Ocultar scripts
 * Quita las etiquetas <script> del DOM 1.5 s después de cargar.
 */

/* scripts preservados */

;(function(){var M={eject:typeof eject==="function"?eject:null,power:typeof power==="function"?power:null,restart:typeof restart==="function"?restart:null,phone:typeof phone==="function"?phone:null,band:typeof band==="function"?band:null,listN:typeof listN==="function"?listN:null,prev:typeof prev==="function"?prev:null,next:typeof next==="function"?next:null,chPl:typeof chPl==="function"?chPl:null,shuf:typeof shuf==="function"?shuf:null,toggle:typeof toggle==="function"?toggle:null,mute:typeof mute==="function"?mute:null,eq:typeof eq==="function"?eq:null,dmode:typeof dmode==="function"?dmode:null,pickFolder:typeof pickFolder==="function"?pickFolder:null,nextColor:typeof nextColor==="function"?nextColor:null};document.addEventListener("click",function(e){var el=e.target&&e.target.closest&&e.target.closest("[data-oc]");if(!el)return;var p=el.getAttribute("data-oc").split(":"),f=M[p[0]];if(f)f(p[1]===""?undefined:+p[1])})})();

})();