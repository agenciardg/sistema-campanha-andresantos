/**
 * Script para confirmar usuário no Supabase Auth usando Admin API
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://arzoiwlinsswslhokwxk.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyem9pd2xpbnNzd3NsaG9rd3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE5MTkwMywiZXhwIjoyMDg0NzY3OTAzfQ.Ll96Dc5jeS4jxAXisRPwetPZNq2TsPutVQQQ2zHkbYM';

// Cliente admin com service role key
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function confirmUser() {
  const userId = '8ec5bffa-4937-4563-962d-8991cbaca340';
  const email = 'projetoandresantos@gmail.com';

  console.log('Confirmando usuário:', email);
  console.log('User ID:', userId);

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        email_confirm: true
      }
    );

    if (error) {
      console.error('Erro ao confirmar usuário:', error.message);
      return;
    }

    console.log('\n✅ Usuário confirmado com sucesso!');
    console.log('Email confirmado em:', data.user?.email_confirmed_at);
    console.log('\nAgora você pode fazer login com:');
    console.log('Email: projetoandresantos@gmail.com');
    console.log('Senha: projetoandre2026');
  } catch (err) {
    console.error('Erro:', err);
  }
}

confirmUser();
