const servicesPrices = {
  'Lavagem Técnica': 120,
  'Polimento': 450,
  'Vitrificação': 1200,
  'Higienização Interna': 300,
  'Revitalização de Farol': 180
};

let bookings = JSON.parse(localStorage.getItem('cleanCarBookings') || '[]');
let currentQRCodeData = null;

function save(){ localStorage.setItem('cleanCarBookings', JSON.stringify(bookings)); renderAdmin(); }
function showSection(id){ document.querySelectorAll('.section').forEach(s=>s.classList.remove('active')); document.getElementById(id).classList.add('active'); if(id==='admin') renderAdmin(); if(id==='checkin') startScanner(); }
function osNumber(){ return `CC-${new Date().getFullYear()}-${String(bookings.length+1).padStart(6,'0')}`; }

const form = document.getElementById('bookingForm');
form.addEventListener('submit', e => {
  e.preventDefault();
  const booking = {
    os: osNumber(),
    name: name.value.trim(),
    phone: phone.value.trim(),
    car: car.value.trim(),
    plate: plate.value.trim().toUpperCase(),
    service: service.value,
    price: servicesPrices[service.value] || 0,
    date: date.value,
    time: time.value,
    notes: notes.value.trim(),
    status: 'Agendado',
    createdAt: new Date().toISOString(),
    timeline: [{status:'Agendado', at:new Date().toLocaleString('pt-BR')}]
  };
  bookings.push(booking); save(); showTicket(booking); form.reset();
});

function showTicket(b){
  currentQRCodeData = JSON.stringify({ os:b.os, plate:b.plate, phone:b.phone });
  document.getElementById('ticket').classList.remove('hidden');
  document.getElementById('ticketInfo').innerHTML = `<strong>OS:</strong> ${b.os}<br><strong>Cliente:</strong> ${b.name}<br><strong>Veículo:</strong> ${b.car} - ${b.plate}<br><strong>Serviço:</strong> ${b.service}<br><strong>Data:</strong> ${b.date} às ${b.time}`;
  document.getElementById('qrcode').innerHTML = '';
  new QRCode(document.getElementById('qrcode'), { text: currentQRCodeData, width: 190, height: 190 });
  document.getElementById('whatsappBtn').onclick = () => sendWhatsapp(b, 'confirmacao');
}

function cleanPhone(p){ return p.replace(/\D/g,''); }
function sendWhatsapp(b, type){
  const messages = {
    confirmacao: `Olá ${b.name}, seu agendamento na Clean Car foi confirmado.%0AOS: ${b.os}%0AServiço: ${b.service}%0AData: ${b.date} às ${b.time}.%0AApresente o QR Code na entrada.`,
    recebido: `Olá ${b.name}, seu veículo foi recebido pela equipe Clean Car. OS: ${b.os}.`,
    iniciado: `Olá ${b.name}, o serviço ${b.service} foi iniciado no seu veículo.`,
    pronto: `Olá ${b.name}, seu veículo está pronto para retirada na Clean Car.`,
    entregue: `Obrigado ${b.name}. Seu veículo foi entregue. A Clean Car agradece sua confiança.`
  };
  window.open(`https://wa.me/55${cleanPhone(b.phone)}?text=${messages[type]}`, '_blank');
}

function renderAdmin(){
  totalBookings.textContent = bookings.length;
  inProgress.textContent = bookings.filter(b=>!['Entregue','Agendado'].includes(b.status)).length;
  done.textContent = bookings.filter(b=>b.status==='Entregue').length;
  bookingTable.innerHTML = bookings.map(b => `<tr><td>${b.os}</td><td>${b.name}</td><td>${b.car}<br>${b.plate}</td><td>${b.service}<br>R$ ${b.price}</td><td>${b.date}<br>${b.time}</td><td>${b.status}</td><td>${actions(b.os)}</td></tr>`).join('');
}
function actions(os){ return ['Veículo recebido','Serviço iniciado','Em execução','Finalização','Pronto para retirada','Entregue'].map(s=>`<button class="action" onclick="updateStatus('${os}','${s}')">${s}</button>`).join(''); }
function updateStatus(os, status){ const b = bookings.find(x=>x.os===os); if(!b) return; b.status=status; b.timeline.push({status, at:new Date().toLocaleString('pt-BR')}); save(); if(status==='Veículo recebido') sendWhatsapp(b,'recebido'); if(status==='Serviço iniciado') sendWhatsapp(b,'iniciado'); if(status==='Pronto para retirada') sendWhatsapp(b,'pronto'); if(status==='Entregue') sendWhatsapp(b,'entregue'); }

function manualCheckin(){ checkinByOs(document.getElementById('manualOs').value.trim()); }
function checkinByOs(os){ const b = bookings.find(x=>x.os===os); if(!b){ checkinResult.innerHTML='<p>OS não encontrada.</p>'; return; } checkinResult.innerHTML = `<h3>${b.os}</h3><p>${b.name}<br>${b.car} - ${b.plate}<br>${b.service}<br>Status atual: <strong>${b.status}</strong></p><button class="primary" onclick="updateStatus('${b.os}','Veículo recebido');checkinByOs('${b.os}')">Dar entrada no veículo</button>`; }

let scannerStarted=false;
function startScanner(){
  if(scannerStarted || typeof Html5QrcodeScanner === 'undefined') return; scannerStarted=true;
  const scanner = new Html5QrcodeScanner('reader', { fps:10, qrbox:250 });
  scanner.render(decoded => { try{ const data=JSON.parse(decoded); checkinByOs(data.os); } catch(e){ checkinByOs(decoded); } });
}

renderAdmin();
