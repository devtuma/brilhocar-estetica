/* ============================================================
   BRILHO CAR — landing.js
   Carrega serviços do Firebase e configurações
   ============================================================ */

let allServices = [];
let businessSettings = {};

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
    console.info('[landing] Firebase mode:', mode);

    // Carregar configurações do negócio
    try {
        businessSettings = await FB.getAllSettings() || {};
    } catch (e) {
        console.warn('[landing] Erro ao carregar settings:', e);
    }

    // Atualizar WhatsApp dinâmico
    updateWhatsAppLinks();

    await loadServices();
    renderServices();
    renderStats();
    renderAboutSection();
    renderTestimonials();
});

/**
 * Atualiza todos os links de WhatsApp na página com o número das configurações
 */
function updateWhatsAppLinks() {
    const whatsapp = businessSettings.whatsapp || '5511999999999';
    const cleanWhats = whatsapp.replace(/\D/g, '');

    // WhatsApp do botão principal
    const whatsappBtn = document.getElementById('whatsappBtn');
    if (whatsappBtn) {
        whatsappBtn.href = `https://wa.me/${cleanWhats}`;
    }

    // WhatsApp flutuante
    const whatsappFloat = document.getElementById('whatsappFloat');
    if (whatsappFloat) {
        whatsappFloat.href = `https://wa.me/${cleanWhats}`;
    }
}

async function loadServices() {
    try {
        allServices = await FB.get('services');
    } catch (e) {
        console.warn('[landing] Erro ao carregar serviços:', e);
        allServices = [];
    }
}

/**
 * Renderiza os cards de serviços com preço, duração e descrição
 */
function renderServices() {
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;

    let services = allServices.filter(s => s.ativo !== false);

    // Fallback caso não tenha nada no Firebase
    if (services.length === 0) {
        services = [
            { id: 's1', nome: 'Lavagem Técnica', preco: 80, duracao: '1-2h', descricao: 'Lavagem completa interna e externa.' },
            { id: 's2', nome: 'Polimento', preco: 250, duracao: '4-6h', descricao: 'Remoção de riscos e oxidação.' },
            { id: 's3', nome: 'Vitrificação', preco: 800, duracao: '1 dia', descricao: 'Proteção cerâmica de longa duração.' },
            { id: 's4', nome: 'Higienização Interna', preco: 200, duracao: '3-4h', descricao: 'Bancos, tapetes, teto e painel.' },
            { id: 's5', nome: 'Revitalização de Farol', preco: 150, duracao: '2h', descricao: 'Restauração da transparência.' },
        ];
    }

    const whatsapp = businessSettings.whatsapp || '5511999999999';
    const whatsappLink = `https://wa.me/${whatsapp.replace(/\D/g, '')}`;

    grid.innerHTML = services
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map(s => {
            const preco = s.preco ? `R$ ${Number(s.preco).toLocaleString('pt-BR')}` : 'Consultar';
            const desconto = parseFloat(s.desconto) || 0;
            const precoComDesconto = desconto > 0 && s.preco > 0
                ? `R$ ${(s.preco * (1 - desconto/100)).toLocaleString('pt-BR')}`
                : null;

            return `
            <div class="service-card" onclick="agendarServico('${escapeHtml(s.id)}')">
                <div class="service-card__content">
                    <h3 class="service-card__title">${escapeHtml(s.nome)}</h3>
                    <div class="service-card__price">
                        ${precoComDesconto
                            ? `<span class="service-card__price-original">${preco}</span>
                               <span class="service-card__price-discount">${precoComDesconto}</span>`
                            : `<span class="service-card__price-main">${preco}</span>`
                        }
                    </div>
                    <p class="service-card__duration"><i class="fas fa-clock"></i> ${escapeHtml(s.duracao || 'A combinar')}</p>
                    <p class="service-card__description">${escapeHtml(s.descricao || s.desc || '')}</p>
                    <a href="${whatsappLink}" target="_blank" class="btn btn--outline btn--sm service-card__cta" onclick="event.stopPropagation()">
                        <i class="fab fa-whatsapp"></i> Agendar
                    </a>
                </div>
            </div>
        `}).join('');
}

function agendarServico(serviceId) {
    // Validação básica para evitar navegação com ID inválido
    if (!serviceId || typeof serviceId !== 'string') {
        window.location.href = 'booking.html';
        return;
    }
    // Escapa o ID antes de usar na URL
    const encodedId = encodeURIComponent(serviceId.replace(/[^a-zA-Z0-9-_]/g, ''));
    window.location.href = `booking.html?service=${encodedId}`;
}

/**
 * Renderiza as estatísticas do negócio (KPIs)
 */
function renderStats() {
    const container = document.getElementById('statsGrid');
    if (!container) return;

    const stats = businessSettings.stats || [
        { value: 500, suffix: '+', label: 'Carros Atendidos' },
        { value: 5, suffix: '+', label: 'Anos de Experiência' },
        { value: 4.9, suffix: '★', label: 'Avaliação', isDecimal: true },
        { value: 100, suffix: '%', label: 'Satisfação' }
    ];

    container.innerHTML = stats.map(st => `
        <div class="stat-item">
            <div class="stat-item__value">
                ${st.isDecimal ? Number(st.value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : Number(st.value).toLocaleString('pt-BR')}
                <span class="stat-item__suffix">${escapeHtml(st.suffix)}</span>
            </div>
            <div class="stat-item__label">${escapeHtml(st.label)}</div>
        </div>
    `).join('');
}

/**
 * Renderiza a seção "Sobre Nós" com dados das configurações
 */
function renderAboutSection() {
    // Atualizar tagline se existir
    const tagline = document.getElementById('aboutTagline');
    if (tagline && businessSettings.tagline) {
        tagline.textContent = businessSettings.tagline;
    }

    // Atualizar texto do sobre
    const aboutText = document.getElementById('aboutText');
    if (aboutText && businessSettings.businessName) {
        aboutText.textContent = `Localizada em Mauá, a ${businessSettings.businessName} é referência em estética automotiva de alto padrão. Utilizamos produtos premium e técnicas certificadas para devolver a beleza e proteção que seu veículo merece.`;
    }

    // Atualizar imagem do sobre se configurada
    const aboutImg = document.getElementById('aboutImg');
    if (aboutImg && businessSettings.aboutImage) {
        aboutImg.src = businessSettings.aboutImage;
        aboutImg.alt = `Sobre ${businessSettings.businessName || 'Brilho Car'}`;
    }

    // Atualizar horário
    const aboutHorario = document.getElementById('aboutHorario');
    if (aboutHorario && businessSettings.horario) {
        aboutHorario.innerHTML = `<i class="fas fa-clock"></i> ${escapeHtml(businessSettings.horario)}`;
    }

    // Atualizar endereço
    const aboutAddress = document.getElementById('aboutAddress');
    if (aboutAddress && businessSettings.address) {
        aboutAddress.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${escapeHtml(businessSettings.address)}`;
    }
}

/**
 * Renderiza os depoimentos na landing page
 */
async function renderTestimonials() {
    const container = document.getElementById('testimonialsGrid');
    if (!container) return;

    let testimonials = [];
    try {
        testimonials = await FB.get('testimonials');
        testimonials = testimonials.filter(t => t.ativo !== false);
    } catch (e) {
        console.warn('[landing] Erro ao carregar depoimentos:', e);
    }

    // Fallback se não houver depoimentos
    if (testimonials.length === 0) {
        testimonials = [
            { nome: 'Marcos A.', veiculo: 'Honda Civic', texto: 'Polimento impecável. Resultado acima das expectativas!', estrelas: 5 },
            { nome: 'Rodrigo S.', veiculo: 'Toyota Corolla', texto: 'Vitrificação perfeita. Carro brilhando como novo.', estrelas: 5 },
            { nome: 'Ana C.', veiculo: 'Volkswagen T-Cross', texto: 'Higienização interna impecável. Recomendo!', estrelas: 5 },
        ];
    }

    container.innerHTML = testimonials
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .slice(0, 4)
        .map(t => `
            <div class="testimonial-card">
                <div class="testimonial-card__stars">
                    ${'★'.repeat(Math.min(5, t.estrelas || 5))}
                </div>
                <p class="testimonial-card__text">"${escapeHtml(t.texto)}"</p>
                <div class="testimonial-card__author">
                    <strong>${escapeHtml(t.nome)}</strong>
                    ${t.veiculo ? `<span>${escapeHtml(t.veiculo)}</span>` : ''}
                </div>
            </div>
        `).join('');
}
