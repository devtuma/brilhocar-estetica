// Script para criar agendamento de TESTE via Cloud Function
// Este script chama a função createAppointmentWithSlotLock diretamente

const https = require('https');

const FUNCTION_URL = 'https://us-central1-brilhocar-estetica-9f14b.cloudfunctions.net/createAppointmentWithSlotLock';

const TEST_APPOINTMENT = {
  name: 'Cliente Teste E2E',
  celular: '11999990001',
  car: 'Honda Civic',
  plate: 'ABC1D23',
  date: '2026-08-21',
  time: '10:00',
  services: [{ id: 'lavagem-tecnica', name: 'Lavagem Técnica', price: 150 }],
  serviceNames: 'Lavagem Técnica',
  totalPrice: 150,
  totalDuration: 60,
  status: 'Aguardando Pagamento',
  pixStatus: 'pending',
  obs: 'Teste automático E2E'
};

async function createTestAppointment() {
  console.log('Criando agendamento de teste...\n');

  const body = JSON.stringify({
    appointmentData: TEST_APPOINTMENT
  });

  const options = {
    hostname: 'us-central1-brilhocar-estetica-9f14b.cloudfunctions.net',
    path: '/createAppointmentWithSlotLock',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('Resposta:', JSON.stringify(result, null, 2));
          resolve(result);
        } catch (e) {
          console.log('Resposta raw:', data);
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function simulatePayment(appointmentId) {
  console.log('\nSimulando pagamento PIX...\n');

  const body = JSON.stringify({
    appointmentId
  });

  const options = {
    hostname: 'us-central1-brilhocar-estetica-9f14b.cloudfunctions.net',
    path: '/simulatePaymentConfirmed',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('Resposta:', JSON.stringify(result, null, 2));
          resolve(result);
        } catch (e) {
          console.log('Resposta raw:', data);
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    // Criar agendamento
    const result = await createTestAppointment();

    if (result.result?.appointmentId) {
      const appointmentId = result.result.appointmentId;
      console.log('\n✅ Agendamento criado!');
      console.log(`🔗 https://brilhocar-estetica.vercel.app/pagamento/${appointmentId}`);

      // Aguardar 2 segundos
      await new Promise(r => setTimeout(r, 2000));

      // Simular pagamento
      await simulatePayment(appointmentId);
      console.log('\n✅ Pagamento simulado!');
      console.log(`🔗 https://brilhocar-estetica.vercel.app/track`);
    } else {
      console.log('\n❌ Erro ao criar agendamento');
      console.log(result);
    }
  } catch (err) {
    console.error('Erro:', err);
  }
}

main();
