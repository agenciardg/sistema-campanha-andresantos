/**
 * Script para criar usuário no Supabase Auth
 * Execute com: node scripts/create-user.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://arzoiwlinsswslhokwxk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyem9pd2xpbnNzd3NsaG9rd3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTE5MDMsImV4cCI6MjA4NDc2NzkwM30.Y0gFZKlALATIRCdXCnjWwz7Uyw5_Z7QWtEsNfqHSBC8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createUser() {
  console.log('Criando usuário no Supabase Auth...');
  console.log('Email: projetoandresantos@gmail.com');

  const { data, error } = await supabase.auth.signUp({
    email: 'projetoandresantos@gmail.com',
    password: 'projetoandre2026',
    options: {
      data: {
        nome: 'Projeto André Santos',
        tipo: 'admin'
      }
    }
  });

  if (error) {
    console.error('Erro ao criar usuário:', error.message);

    if (error.message.includes('already registered')) {
      console.log('\nUsuário já existe! Tentando fazer login...');

      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'projetoandresantos@gmail.com',
        password: 'projetoandre2026'
      });

      if (loginError) {
        console.error('Erro no login:', loginError.message);
      } else {
        console.log('\n✅ Login bem-sucedido!');
        console.log('User ID:', loginData.user?.id);
        console.log('Email:', loginData.user?.email);
      }
    }
    return;
  }

  console.log('\n✅ Usuário criado com sucesso!');
  console.log('User ID:', data.user?.id);
  console.log('Email:', data.user?.email);

  if (data.user?.identities?.length === 0) {
    console.log('\n⚠️  ATENÇÃO: Usuário já existe com este email.');
  } else if (data.session) {
    console.log('\n✅ Sessão criada automaticamente (email confirmation desabilitado)');
  } else {
    console.log('\n📧 Verifique o email para confirmar a conta (se email confirmation estiver habilitado)');
  }
}

createUser();
