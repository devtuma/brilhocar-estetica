/* ============================================================
   BRILHO CAR — booking-page.js
   Página de agendamento com QR Code
   ============================================================ */

let allServices = [];
let businessSettings = {};
let isSubmitting = false;

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
    const mode = await FB.init();
    console.info('[booking] Firebase mode:', mode);

    // Carregar configurações
    try {
        businessSettings = await FB.getAllSettings() || {};
    } catch (e) {
        console.warn('[booking] Erro ao carregar settings:', e);
    }

    // Data mínima = hoje
    const dateInput = document.getElementById('bkData');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
    }

    await loadServices();
    populateServices();

    // Pré-selecionar serviço da URL
    const params = new URLSearchParams(window.location.search);
    const preId = params.get('service');
    if (preId) {
        const select = document.getElementById('bkServico');
        // Valida o ID antes de usar
        const validId = preId.replace(/[^a-zA-Z0-9-_]/g, '');
        if (select && validId) select.value = validId;
    }
});

async function loadServices() {
    try {
        allServices = await FB.get('services');
    } catch (e) {
        allServices = [];
    }
}

function populateServices() {
    const select = document.getElementById('bkServico');
    if (!select) return;

    let services = allServices.filter(s => s.ativo !== false);
    if (services.length === 0) {
        services = [
            { id: 's1', nome: 'Lavagem Técnica', preco: 80 },
            { id: 's2', nome: 'Polimento', preco: 250 },
            { id: 's3', nome: 'Vitrificação', preco: 800 },
            { id: 's4', nome: 'Higienização Interna', preco: 200 },
            { id: 's5', nome: 'Revitalização de Farol', preco: 150 },
        ];
    }

    services.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    select.innerHTML = '<option value="" disabled selected>Selecione o serviço</option>' +
        services.map(s => {
            const preco = s.preco ? ` - R$ ${Number(s.preco).toLocaleString('pt-BR')}` : '';
            return `<option value="${escapeHtml(s.id)}">${escapeHtml(s.nome)}${preco}</option>`;
        }).join('');
}

/**
 * Validação de placa brasileira ( Mercosul e tradicional )
 */
function validarPlaca(placa) {
    if (!placa) return true; // Placa é opcional
    const placaLimpa = placa.toUpperCase().replace(/-/g, '');
    // Mercosul: ABC1D23 (4 letras + 3 números)
    const mercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    // Tradicional: ABC-1234 (3 letras + 4 números)
    const tradicional = /^[A-Z]{3}[0-9]{4}$/;
    return mercosul.test(placaLimpa) || tradicional.test(placaLimpa);
}

/**
 * Validação de telefone brasileiro
 */
function validarTelefone(tel) {
    const numeros = tel.replace(/\D/g, '');
    return numeros.length >= 10 && numeros.length <= 13;
}

async function confirmarAgendamento() {
    // Previne double-click
    if (isSubmitting) return;
    isSubmitting = true;

    const btn = document.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    try {
        const nome    = document.getElementById('bkNome')?.value.trim();
        const tel     = document.getElementById('bkTel')?.value.trim();
        const veiculo = document.getElementById('bkVeiculo')?.value.trim();
        const placa   = document.getElementById('bkPlaca')?.value.trim();
        const servicoId  = document.getElementById('bkServico')?.value;
        const data    = document.getElementById('bkData')?.value;
        const hora    = document.getElementById('bkHora')?.value;
        const obs     = document.getElementById('bkObs')?.value.trim();

        // Validações
        if (!nome || !tel || !servicoId || !data || !hora) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        if (!validarTelefone(tel)) {
            alert('Telefone inválido. Digite um número com DDD.');
            return;
        }

        if (!validarPlaca(placa)) {
            alert('Placa inválida. Use o formato ABC-1234 ou ABC1D23.');
            return;
        }

        const servico = allServices.find(s => s.id === servicoId);
        const servicoNome = servico ? servico.nome : 'Serviço';
        const valor = servico ? (Number(servico.preco) || 0) : 0;

        const osNumber = generateOSNumber();
        const appointmentId = FB.uid();

        const qrCodeData = JSON.stringify({
            appointmentId,
            osNumber,
            plate: placa
        });

        const appointment = {
            osNumber,
            clienteNome: nome,
            tel,
            veiculo,
            placa,
            serviceId: servicoId,
            serviceNome: servicoNome,
            data,
            hora,
            valor,
            status: 'agendado',
            qrCodeData,
            obs,
        };

        const saved = await FB.insert('appointments', appointment);
        await upsertCliente({ nome, tel, veiculo });

        // Mostra tela de sucesso com QR Code
        mostrarConfirmacao({
            ...appointment,
            id: saved.id,
            qrCodeData
        });

    } catch (e) {
        console.error('[booking] Erro ao salvar:', e);
        alert('Erro ao confirmar agendamento. Tente novamente.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        isSubmitting = false;
    }
}

/**
 * Mostra a tela de confirmação com QR Code
 */
function mostrarConfirmacao(ag) {
    const whatsapp = businessSettings.whatsapp || '5511999999999';
    const cleanWhats = whatsapp.replace(/\D/g, '');

    const [y, m, d] = ag.data.split('-').map(Number);
    const dateLabel = new Date(y, m - 1, d).toLocaleDateString('pt-BR');

    // Gera QR Code usando API externa
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ag.qrCodeData)}`;

    // Monta mensagem do WhatsApp (dados já escapados via escapeHtml)
    const clienteNome = escapeHtml(ag.clienteNome);
    const veiculo = escapeHtml(ag.veiculo || 'Não informado');
    const placa = ag.placa ? ` (${escapeHtml(ag.placa)})` : '';
    const serviceNome = escapeHtml(ag.serviceNome);
    const hora = escapeHtml(ag.hora);
    const osNumber = escapeHtml(ag.osNumber);
    const valor = ag.valor ? `R$ ${Number(ag.valor).toLocaleString('pt-BR')}` : '';

    const msg =
        `Olá, ${clienteNome}! 👋\n\n` +
        `Seu agendamento na Brilho Car foi confirmado!\n\n` +
        `🚗 Serviço: ${serviceNome}\n` +
        `📅 Data: ${dateLabel}\n` +
        `⏰ Horário: ${hora}\n` +
        `📋 OS: ${osNumber}\n\n` +
        `Apresente seu QR Code na entrada.`;

    const whatsappUrl = `https://wa.me/${cleanWhats}?text=${encodeURIComponent(msg)}`;

    // Substitui o formulário pela tela de confirmação
    const form = document.querySelector('.booking-form');
    form.innerHTML = `
        <div class="confirmacao-container">
            <div class="confirmacao-header">
                <i class="fas fa-check-circle text-neon" style="font-size: 4rem; display: block; text-align: center; margin-bottom: 16px;"></i>
                <h2 class="confirmacao-title">Agendamento Confirmado!</h2>
                <p class="confirmacao-subtitle">Anote seu número de OS ou tire uma captura desta tela.</p>
            </div>

            <div class="confirmacao-card">
                <div class="confirmacao-os">
                    <span class="confirmacao-os-label">Número da OS</span>
                    <span class="confirmacao-os-value">${osNumber}</span>
                </div>

                <div class="confirmacao-details">
                    <div class="confirmacao-detail">
                        <i class="fas fa-user"></i>
                        <span>${clienteNome}</span>
                    </div>
                    <div class="confirmacao-detail">
                        <i class="fas fa-car"></i>
                        <span>${veiculo}${placa}</span>
                    </div>
                    <div class="confirmacao-detail">
                        <i class="fas fa-tools"></i>
                        <span>${serviceNome}</span>
                    </div>
                    <div class="confirmacao-detail">
                        <i class="fas fa-calendar"></i>
                        <span>${dateLabel}</span>
                    </div>
                    <div class="confirmacao-detail">
                        <i class="fas fa-clock"></i>
                        <span>${hora}</span>
                    </div>
                    ${ag.valor ? `
                    <div class="confirmacao-detail">
                        <i class="fas fa-dollar-sign"></i>
                        <span>${valor}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="confirmacao-qr">
                    <p class="confirmacao-qr-label">QR Code para Check-in</p>
                    <img src="${qrUrl}" alt="QR Code" class="confirmacao-qr-image">
                    <p class="confirmacao-qr-hint">Apresente este QR Code na entrada</p>
                </div>
            </div>

            <div class="confirmacao-actions">
                <a href="${whatsappUrl}" target="_blank" class="btn btn--neon btn--full">
                    <i class="fab fa-whatsapp"></i> Receber confirmação no WhatsApp
                </a>
                <a href="index.html" class="btn btn--outline btn--full">
                    <i class="fas fa-home"></i> Voltar ao Início
                </a>
            </div>
        </div>
    `;

    // Adiciona estilos inline para a confirmação
    const style = document.createElement('style');
    style.textContent = `
        .confirmacao-container { text-align: center; max-width: 500px; margin: 0 auto; }
        .confirmacao-header { margin-bottom: 32px; }
        .confirmacao-title { font-size: 1.8rem; font-weight: 800; margin-bottom: 8px; }
        .confirmacao-subtitle { color: var(--text-muted); }
        .confirmacao-card {
            background: var(--card);
            border: 2px solid var(--neon);
            border-radius: var(--radius-lg);
            padding: 32px;
            margin-bottom: 24px;
            box-shadow: 0 0 30px rgba(57, 255, 20, 0.15);
        }
        .confirmacao-os {
            background: var(--bg-2);
            border-radius: var(--radius);
            padding: 20px;
            margin-bottom: 24px;
        }
        .confirmacao-os-label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px; }
        .confirmacao-os-value {
            font-size: 2rem;
            font-weight: 900;
            color: var(--neon);
            letter-spacing: 2px;
        }
        .confirmacao-details { margin-bottom: 24px; text-align: left; }
        .confirmacao-detail {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
        }
        .confirmacao-detail:last-child { border-bottom: none; }
        .confirmacao-detail i { color: var(--neon); width: 20px; }
        .confirmacao-qr { text-align: center; }
        .confirmacao-qr-label { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 12px; }
        .confirmacao-qr-image {
            width: 180px;
            height: 180px;
            border-radius: var(--radius);
            border: 2px solid var(--neon);
            background: #fff;
            padding: 8px;
        }
        .confirmacao-qr-hint { font-size: 0.8rem; color: var(--text-muted); margin-top: 8px; }
        .confirmacao-actions { display: flex; flex-direction: column; gap: 12px; }
    `;
    document.head.appendChild(style);
}

async function upsertCliente({ nome, tel, veiculo }) {
    if (!tel) return;
    const telNorm = tel.replace(/\D/g, '');
    try {
        const clients = await FB.get('clients');
        const existing = clients.find(c => (c.tel || '').replace(/\D/g, '') === telNorm);
        if (!existing) {
            await FB.insert('clients', {
                nome, tel,
                veiculos: veiculo || '',
                obs: '',
                totalSpent: 0,
                totalVisits: 0,
            });
        } else if (veiculo && !(existing.veiculos || '').includes(veiculo)) {
            const novos = existing.veiculos
                ? `${existing.veiculos}, ${veiculo}`
                : veiculo;
            await FB.update('clients', existing.id, { veiculos: novos });
        }
    } catch (e) {
        console.warn('[booking] Cliente upsert falhou:', e);
    }
}

function generateOSNumber() {
    const year = new Date().getFullYear();
    const random = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
    return `BC-${year}-${random}`;
}
