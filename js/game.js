
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 900;
const H = 600;

const $ = id => document.getElementById(id);

let mode = 'menu';
let score = 0;
let lives = 3;
let level = 1;
let record = Number(localStorage.getItem('spaceRushRecord') || 0);
let x = W / 2;

let objects = [];
let particles = [];
let stars = [];

let keys = {
    left: false,
    right: false
};

let spawn = 0;
let inv = 0;
let elapsed = 0;
let last = 0;

let serialPort = null;
let serialReader = null;
let serialActive = false;
let serialBuffer = '';

const palette = () => {
    let s = getComputedStyle(document.documentElement);

    return name => s.getPropertyValue('--' + name).trim();
};

let phase = 0;
let transition = 1;
let lastMilestone = 0;

const zones = [
    ['#070d22', '#293e72', '#817d8c', '#d9b8b2'],
    ['#190b20', '#722841', '#e56b55', '#ffd3a1'],
    ['#061a30', '#1b6a90', '#a4e9fc', '#f1ffff'],
    ['#210c14', '#86321b', '#ff803c', '#ffdb81'],
    ['#140b30', '#603b9e', '#b787f5', '#f5d6ff']
];

// Inicialização das estrelas
for (let i = 0; i < 145; i++) {
    stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: .6 + Math.random() * 2,
        v: .6 + Math.random() * 2.8
    });
}

// Atualização do HUD
function hud() {
    $('score').textContent = String(Math.floor(score)).padStart(6, '0');

    $('record').textContent = String(
        Math.max(record, Math.floor(score))
    ).padStart(6, '0');

    $('lives').textContent = '♥ '.repeat(lives) || '—';
}

// Reiniciar jogo
function reset() {
    if (!serialActive || !serialPort) {
        alert('Conecte o Arduino antes de jogar.');
        return;
    }

    mode = 'playing';
    score = 0;
    lives = 3;
    level = 1;
    phase = 0;
    transition = 1;
    lastMilestone = 0;
    x = W / 2;

    objects = [];
    particles = [];

    spawn = 0;
    elapsed = 0;
    inv = 1;

    keys.left = keys.right = false;

    $('menu').classList.add('hidden');
    $('end').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('pause').classList.remove('hidden');

    hud();
}

// Finalizar jogo
function finish() {
    mode = 'over';
    keys.left = keys.right = false;

    if (score > record) {
        record = Math.floor(score);
        localStorage.setItem('spaceRushRecord', record);
    }

    hud();

    $('summary').textContent =
        `${Math.floor(score)} pontos · Recorde: ${record}`;

    $('end').classList.remove('hidden');
    $('pause').classList.add('hidden');
}

// Criar partículas
function burst(px, py, color, n = 24) {
    for (let i = 0; i < n; i++) {
        let a = Math.random() * Math.PI * 2;
        let v = 1 + Math.random() * 5;

        particles.push({
            x: px,
            y: py,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            t: 25 + Math.random() * 25,
            c: color
        });
    }
}

// Atualização da lógica do jogo
function update(dt) {
    const f = Math.min(dt * 60, 2.4);
    const p = palette();

    elapsed += dt;
    score += dt * (9 + level * 2);

    level = Math.min(15, 1 + Math.floor(score / 180));

    let milestone = Math.floor(score / 1000);

    if (milestone > lastMilestone) {
        lastMilestone = milestone;

        const row = document.querySelector('.points');

        row.classList.remove('flash');
        void row.offsetWidth;
        row.classList.add('flash');
    }

    let nextPhase = Math.min(4, milestone);

    if (nextPhase !== phase) {
        phase = nextPhase;
        transition = 0;
    }

    transition = Math.min(1, transition + dt * .5);
    inv = Math.max(0, inv - dt);

    // Movimento da nave
    if (keys.left) x -= 8 * f;
    if (keys.right) x += 8 * f;

    x = Math.max(35, Math.min(W - 35, x));

    // Gerar obstáculos
    spawn += dt;

    if (spawn > Math.max(.21, .85 - level * .042)) {
        spawn = 0;

        const crystal = Math.random() < .23;

        objects.push({
            x: 35 + Math.random() * (W - 70),
            y: -45,
            r: crystal ? 18 : 23 + Math.random() * 16,
            type: crystal ? 'crystal' : 'rock',
            v: 3.1 + level * .62 + Math.random() * 1.7,
            a: Math.random() * 6.28,
            spin: (Math.random() - .5) * .05
        });
    }

    // Movimentar e detectar colisões
    for (const o of objects) {
        o.y += o.v * f;
        o.a += o.spin * f;

        if (
            !o.dead &&
            Math.hypot(o.x - x, o.y - (H - 75)) < o.r + 24
        ) {
            if (o.type === 'crystal') {
                o.dead = true;
                score += 65;

                burst(o.x, o.y, p('crystal'), 18);

            } else if (inv === 0) {
                o.dead = true;
                lives--;
                inv = 1.35;

                burst(x, H - 75, p('danger'), 32);

                if (lives <= 0) {
                    finish();
                    return;
                }
            }
        }

        if (o.y > H + 55) {
            o.dead = true;
        }
    }

    objects = objects.filter(o => !o.dead);

    // Atualizar partículas
    for (const q of particles) {
        q.x += q.vx * f;
        q.y += q.vy * f;
        q.t -= f;
    }

    particles = particles.filter(q => q.t > 0);

    // Atualizar recorde
    if (score > record) {
        record = Math.floor(score);

        localStorage.setItem(
            'spaceRushRecord',
            String(record)
        );
    }

    hud();
}

// Desenhar elementos do jogo
function draw() {
    const p = palette();

    const z = zones[phase];
    const prev = zones[Math.max(0, phase - 1)];

    ctx.fillStyle = z[0];
    ctx.fillRect(0, 0, W, H);

    if (transition < 1) {
        ctx.globalAlpha = 1 - transition;
        ctx.fillStyle = prev[0];
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }

    // Fundo com gradiente
    let g = ctx.createRadialGradient(
        W / 2,
        H / 2,
        40,
        W / 2,
        H / 2,
        520
    );

    g.addColorStop(0, z[1] + 'aa');
    g.addColorStop(1, '#00000000');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Estrelas
    for (const s of stars) {
        if (mode === 'playing') {
            s.y = (s.y + s.v * (1 + level * .3)) % H;
        }

        ctx.fillStyle = '#dceaff';
        ctx.globalAlpha = .3 + s.r * .23;

        ctx.fillRect(
            s.x,
            s.y,
            s.r,
            Math.max(s.r, s.v * (1 + level * .35) * 3)
        );
    }

    ctx.globalAlpha = 1;

    // Desenhar objetos
    for (const o of objects) {
        ctx.save();

        ctx.translate(o.x, o.y);
        ctx.rotate(o.a);

        if (o.type === 'crystal') {
            ctx.shadowColor = p('crystal');
            ctx.shadowBlur = 22;

            ctx.fillStyle = p('crystal');
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(15, 0);
            ctx.lineTo(0, 20);
            ctx.lineTo(-15, 0);
            ctx.closePath();

            ctx.fill();
            ctx.stroke();

        } else {
            ctx.fillStyle = z[2];
            ctx.strokeStyle = z[3];
            ctx.lineWidth = 3;

            ctx.beginPath();

            for (let i = 0; i < 11; i++) {
                let a = i * Math.PI * 2 / 11;
                let r = o.r * (i % 3 === 0 ? .79 : 1);

                if (i) {
                    ctx.lineTo(
                        Math.cos(a) * r,
                        Math.sin(a) * r
                    );
                } else {
                    ctx.moveTo(
                        Math.cos(a) * r,
                        Math.sin(a) * r
                    );
                }
            }

            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = z[1];

            for (const [cx, cy, cr] of [
                [-.23, -.24, .24],
                [.32, .18, .18],
                [-.2, .37, .12]
            ]) {
                ctx.beginPath();

                ctx.arc(
                    o.r * cx,
                    o.r * cy,
                    o.r * cr,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }
        }

        ctx.restore();
    }

    // Desenhar nave
    if (!(inv > 0 && Math.floor(elapsed * 14) % 2 === 0)) {
        ctx.save();

        ctx.translate(x, H - 75);

        ctx.shadowColor = p('ship');
        ctx.shadowBlur = 25;

        ctx.fillStyle = p('ship');
        ctx.strokeStyle = p('ship-outline');
        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.moveTo(0, -39);
        ctx.lineTo(12, -14);
        ctx.lineTo(28, -4);
        ctx.lineTo(33, 24);
        ctx.lineTo(15, 17);
        ctx.lineTo(0, 24);
        ctx.lineTo(-15, 17);
        ctx.lineTo(-33, 24);
        ctx.lineTo(-28, -4);
        ctx.lineTo(-12, -14);

        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.fillStyle = '#193a79';

        ctx.beginPath();
        ctx.ellipse(0, -14, 8, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffb25b';

        ctx.beginPath();
        ctx.moveTo(-12, 22);
        ctx.lineTo(0, 44 + Math.random() * 14);
        ctx.lineTo(12, 22);
        ctx.fill();

        ctx.restore();
    }

    // Desenhar partículas
    for (const q of particles) {
        ctx.globalAlpha = Math.min(1, q.t / 20);

        ctx.fillStyle = q.c;
        ctx.fillRect(q.x, q.y, 5, 5);
    }

    ctx.globalAlpha = 1;
}

// Loop principal
function frame(t) {
    let dt = Math.min((t - last) / 1000 || 0, .04);

    last = t;

    if (mode === 'playing') {
        update(dt);
    }

    draw();

    requestAnimationFrame(frame);
}

// Eventos dos botões
$('start').onclick = reset;
$('again').onclick = reset;

$('back').onclick = () => {
    mode = 'menu';

    $('end').classList.add('hidden');
    $('menu').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('pause').classList.add('hidden');
};

// Pausar e continuar
function togglePause() {
    if (mode === 'paused' && !serialActive) {
        alert('Reconecte o Arduino para continuar.');
        return;
    }

    if (mode === 'playing') {
        mode = 'paused';

        keys.left = keys.right = false;

        $('paused').classList.remove('hidden');

    } else if (mode === 'paused') {
        mode = 'playing';

        $('paused').classList.add('hidden');
    }
}

$('pause').onclick = togglePause;

// Tela cheia
$('full').onclick = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        $('shell').requestFullscreen?.();
    }
};

// Controle de direção
function direction(d, on) {
    keys[d] = on;
}

// Nenhuma tecla do notebook controla a nave.
// Apenas comandos seriais do Arduino.
window.addEventListener('blur', () => {
    keys.left = keys.right = false;
});

// Web Serial: mensagens L1/L0 e R1/R0 enviadas
// pelo Arduino a 115200 baud.
$('connect').onclick = async () => {
    if (!('serial' in navigator)) {
        alert(
            'Use Chrome ou Edge compatível com Web Serial, em localhost ou HTTPS.'
        );

        return;
    }

    try {
        if (serialPort) return;

        serialPort = await navigator.serial.requestPort();

        await serialPort.open({
            baudRate: 115200
        });

        $('connection').textContent = '● Arduino conectado por USB';

        $('start').disabled = false;
        $('again').disabled = false;

        $('connection').classList.add('connected');

        $('connect').textContent = '✓ Arduino conectado';

        serialActive = true;

        serialReader = serialPort.readable.getReader();

        const decoder = new TextDecoder();

        while (serialActive) {
            const { value, done } = await serialReader.read();

            if (done) break;

            serialBuffer += decoder.decode(value, {
                stream: true
            });

            let index;

            while ((index = serialBuffer.indexOf('\n')) >= 0) {
                const msg = serialBuffer.slice(0, index).trim();

                serialBuffer = serialBuffer.slice(index + 1);

                if (msg === 'L1') direction('left', true);
                if (msg === 'L0') direction('left', false);

                if (msg === 'R1') direction('right', true);
                if (msg === 'R0') direction('right', false);
            }

            if (serialBuffer.length > 100) {
                serialBuffer = '';
            }
        }

    } catch (err) {
        console.error(err);

        $('connection').textContent =
            'Erro na conexão: ' + err.message;

    } finally {
        serialActive = false;

        keys.left = keys.right = false;

        try {
            serialReader?.releaseLock();
        } catch {}

        try {
            await serialPort?.close();
        } catch {}

        serialPort = null;

        $('connection').classList.remove('connected');

        $('connection').textContent = '● Arduino desconectado';

        $('start').disabled = true;
        $('again').disabled = true;

        $('connect').textContent = 'Conectar Arduino';

        if (mode === 'playing') {
            mode = 'paused';

            $('paused').classList.remove('hidden');
        }
    }
};

// Redimensionar Canvas
function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);

resizeCanvas();

// Inicialização
$('start').disabled = true;
$('again').disabled = true;

hud();

requestAnimationFrame(frame);
