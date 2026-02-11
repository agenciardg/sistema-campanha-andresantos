import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../components/Icon';
import ConfirmModal from '../components/ConfirmModal';
import { cadastrosService, liderancasService, equipesService, coordenadoresService, Cadastro, Lideranca, Equipe, Coordenador } from '../lib/supabase';
import { geocodificarEndereco, reGeocodificarRegistro } from '../lib/geocoding';
import * as XLSX from 'xlsx';

interface NewRegistrationForm {
  name: string;
  phone: string;
  email: string;
  birthdate: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  vinculoTipo: 'lideranca' | 'coordenador' | '';
  vinculoId: string;
}

const Registrations: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeader, setSelectedLeader] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCadastro, setEditingCadastro] = useState<Cadastro | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reGeocodificando, setReGeocodificando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [liderancas, setLiderancas] = useState<Lideranca[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [coordenadores, setCoordenadores] = useState<Coordenador[]>([]);
  const [formData, setFormData] = useState<NewRegistrationForm>({
    name: '',
    phone: '',
    email: '',
    birthdate: '',
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    vinculoTipo: '',
    vinculoId: '',
  });
  const [loadingCep, setLoadingCep] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [cadastrosData, liderancasData, equipesData, coordenadoresData] = await Promise.all([
        cadastrosService.listar(),
        liderancasService.listar(),
        equipesService.listar(),
        coordenadoresService.listar(),
      ]);
      setCadastros(cadastrosData);
      setLiderancas(liderancasData);
      setEquipes(equipesData);
      setCoordenadores(coordenadoresData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return cadastros.filter(cad => {
      const matchesSearch =
        cad.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cad.telefone && cad.telefone.includes(searchTerm)) ||
        (cad.email && cad.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesLeader = selectedLeader === 'Todos' || cad.lideranca_id === selectedLeader;

      return matchesSearch && matchesLeader;
    });
  }, [searchTerm, selectedLeader, cadastros]);

  const exportarXLSX = () => {
    // Preparar dados para exportação
    const dadosExportacao = filteredData.map(cad => {
      const lideranca = liderancas.find(l => l.id === cad.lideranca_id);
      const equipe = lideranca ? equipes.find(e => e.id === lideranca.equipe_id) : null;

      return {
        'Nome': cad.nome,
        'Telefone': cad.telefone || '',
        'Email': cad.email || '',
        'Data de Nascimento': cad.data_nascimento || '',
        'CEP': cad.cep || '',
        'Endereço': cad.endereco || '',
        'Número': cad.numero || '',
        'Bairro': cad.bairro || '',
        'Cidade': cad.cidade || '',
        'Estado': cad.estado || '',
        'Liderança': lideranca?.nome || '',
        'Equipe': equipe?.nome || '',
        'Data de Cadastro': cad.criado_em ? new Date(cad.criado_em).toLocaleDateString('pt-BR') : '',
      };
    });

    // Criar workbook e worksheet
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cadastros');

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 30 }, // Nome
      { wch: 15 }, // Telefone
      { wch: 30 }, // Email
      { wch: 12 }, // Data de Nascimento
      { wch: 10 }, // CEP
      { wch: 40 }, // Endereço
      { wch: 8 },  // Número
      { wch: 20 }, // Bairro
      { wch: 20 }, // Cidade
      { wch: 5 },  // Estado
      { wch: 25 }, // Liderança
      { wch: 20 }, // Equipe
      { wch: 15 }, // Data de Cadastro
    ];
    ws['!cols'] = colWidths;

    // Gerar arquivo e baixar
    const dataAtual = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `cadastros_${dataAtual}.xlsx`);
  };

  const buscarEnderecoPorCep = async (cep: string): Promise<boolean> => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return false;

    setLoadingCep(true);
    try {
      // Tentar BrasilAPI v2 primeiro
      let response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`, {
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        console.warn('BrasilAPI v2 falhou, tentando v1...');
        response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`, {
          signal: AbortSignal.timeout(3000)
        });
      }

      if (response.ok) {
        const data = await response.json();

        setFormData(prev => ({
          ...prev,
          street: data.street || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: data.state || '',
        }));
        return true; // Sucesso
      }

      // Se BrasilAPI falhou, tentar ViaCEP
      console.warn('BrasilAPI falhou, tentando ViaCEP...');
      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
        signal: AbortSignal.timeout(3000)
      });

      if (viaCepResponse.ok) {
        const data = await viaCepResponse.json();

        if (data.erro) {
          alert('⚠️ CEP não encontrado!\n\nEste CEP não foi localizado nos Correios.\n\nVocê pode preencher o endereço MANUALMENTE nos campos abaixo.\n\nIMPORTANTE: O sistema precisa conseguir localizar o endereço no mapa para salvá-lo.');
          return false;
        }

        setFormData(prev => ({
          ...prev,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
        }));
        return true;
      }

      alert('⚠️ CEP não encontrado!\n\nNão foi possível localizar este CEP.\n\nVocê pode preencher o endereço MANUALMENTE nos campos abaixo.\n\nIMPORTANTE: O sistema precisa conseguir localizar o endereço no mapa para salvá-lo.');
      return false;
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      alert('⚠️ Erro ao buscar CEP!\n\nOcorreu um erro na busca.\n\nVocê pode preencher o endereço MANUALMENTE nos campos abaixo.');
      return false;
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, cep: value });

    if (value.replace(/\D/g, '').length === 8) {
      buscarEnderecoPorCep(value);
    }
  };

  // Função para obter coordenadas a partir do endereço usando Nominatim
  const obterCoordenadas = async (enderecoCompleto: string, cidade: string, estado: string): Promise<{ lat: number, lng: number } | null> => {
    try {
      const queryCompleta = `${enderecoCompleto}, ${cidade}, ${estado}, Brasil`;
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryCompleta)}&limit=1&addressdetails=1`, {
        headers: { 'User-Agent': 'CampaignManager/1.0' }
      });
      const data = await response.json();

      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }

      // Fallback: busca sem número
      const enderecoSemNumero = enderecoCompleto.replace(/\s*\d+\s*$/, '').trim();
      if (enderecoSemNumero !== enderecoCompleto) {
        const queryFallback = `${enderecoSemNumero}, ${cidade}, ${estado}, Brasil`;
        const responseFallback = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryFallback)}&limit=1`, {
          headers: { 'User-Agent': 'CampaignManager/1.0' }
        });
        const dataFallback = await responseFallback.json();

        if (dataFallback && dataFallback.length > 0) {
          return { lat: parseFloat(dataFallback[0].lat), lng: parseFloat(dataFallback[0].lon) };
        }
      }

      return null;
    } catch (error) {
      console.error('Erro ao obter coordenadas:', error);
      return null;
    }
  };

  // Abrir modal de edição
  const abrirModalEditar = (cadastro: Cadastro) => {
    const lideranca = liderancas.find(l => l.id === cadastro.lideranca_id);

    setEditingCadastro(cadastro);

    // Determinar tipo de vínculo e ID
    let vinculoTipo: 'lideranca' | 'coordenador' | '' = '';
    let vinculoId = '';

    if (cadastro.lideranca_id) {
      vinculoTipo = 'lideranca';
      vinculoId = cadastro.lideranca_id;
    } else if (cadastro.coordenador_id) {
      vinculoTipo = 'coordenador';
      vinculoId = cadastro.coordenador_id;
    }

    setFormData({
      name: cadastro.nome,
      phone: cadastro.telefone || '',
      email: cadastro.email || '',
      birthdate: cadastro.data_nascimento || '',
      cep: cadastro.cep || '',
      street: cadastro.endereco || '',
      number: cadastro.numero || '',
      neighborhood: cadastro.bairro || '',
      city: cadastro.cidade || '',
      state: cadastro.estado || '',
      vinculoTipo,
      vinculoId,
    });
    setShowEditModal(true);
  };

  // Abrir modal de exclusão
  const abrirModalExcluir = (id: string, nome: string) => {
    setDeleteTarget({ id, nome });
    setShowDeleteModal(true);
  };

  // Confirmar exclusão
  const confirmarExclusao = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await cadastrosService.excluir(deleteTarget.id);
      await carregarDados();
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Erro ao excluir cadastro:', error);
      alert('Erro ao excluir cadastro. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vinculoTipo || !formData.vinculoId) {
      alert('Por favor, selecione uma liderança ou coordenador.');
      return;
    }

    // Validar campos obrigatórios
    if (!formData.birthdate) {
      alert('❌ Data de Nascimento obrigatória!\n\nPor favor, informe a data de nascimento.');
      return;
    }

    if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
      alert('❌ CEP obrigatório!\n\nPor favor, informe um CEP válido de 8 dígitos.');
      return;
    }

    if (!formData.street || !formData.city || !formData.state) {
      alert('❌ Endereço incompleto!\n\nPor favor, preencha:\n- Rua\n- Cidade\n- Estado');
      return;
    }

    try {
      setLoading(true);

      // Geocodificar endereço usando serviço centralizado (BrasilAPI > TomTom)
      console.log('🔍 Geocodificando endereço antes de salvar...');
      const resultado = await geocodificarEndereco({
        cep: formData.cep,
        rua: formData.street,
        numero: formData.number,
        bairro: formData.neighborhood,
        cidade: formData.city,
        estado: formData.state
      });

      if (!resultado.sucesso || !resultado.coordenadas) {
        alert('❌ Não foi possível obter as coordenadas!\n\nO sistema não conseguiu localizar este endereço no mapa.\n\nPossíveis soluções:\n1. Verifique se a cidade e estado estão corretos\n2. Tente informar um CEP válido da região\n3. Certifique-se que o endereço existe');
        setLoading(false);
        return;
      }

      const { latitude, longitude } = resultado.coordenadas;
      console.log(`✅ Coordenadas obtidas: [${latitude}, ${longitude}]`);

      await cadastrosService.criar({
        lideranca_id: formData.vinculoTipo === 'lideranca' ? formData.vinculoId : null,
        coordenador_id: formData.vinculoTipo === 'coordenador' ? formData.vinculoId : null,
        nome: formData.name,
        data_nascimento: formData.birthdate,
        telefone: formData.phone,
        email: formData.email || null,
        cep: formData.cep,
        endereco: formData.street,
        numero: formData.number || null,
        bairro: formData.neighborhood,
        cidade: formData.city,
        estado: formData.state,
        latitude,
        longitude,
        aceite_politica: true,
        origem: 'manual',
      });

      await carregarDados();
      setShowModal(false);
      setFormData({ name: '', phone: '', email: '', birthdate: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '', vinculoTipo: '', vinculoId: '' });
      alert('✅ Cadastro criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar cadastro:', error);
      alert('❌ Erro ao criar cadastro!\n\nOcorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCadastro) return;

    if (!formData.vinculoTipo || !formData.vinculoId) {
      alert('Por favor, selecione uma liderança ou coordenador.');
      return;
    }

    // Validar data de nascimento
    if (!formData.birthdate) {
      alert('❌ Data de Nascimento obrigatória!\n\nPor favor, informe a data de nascimento.');
      return;
    }

    // Validar CEP e endereço
    if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
      alert('❌ CEP obrigatório!\n\nPor favor, informe um CEP válido de 8 dígitos.');
      return;
    }

    if (!formData.street || !formData.city || !formData.state) {
      alert('❌ Endereço incompleto!\n\nO CEP informado não retornou um endereço válido. Por favor, use um CEP existente.');
      return;
    }

    try {
      setLoading(true);

      // Re-geocodificar se o endereço mudou
      let latitude = editingCadastro.latitude;
      let longitude = editingCadastro.longitude;

      const enderecoMudou =
        formData.cep !== editingCadastro.cep ||
        formData.street !== editingCadastro.endereco ||
        formData.number !== editingCadastro.numero ||
        formData.city !== editingCadastro.cidade;

      if (enderecoMudou) {
        console.log('🔄 Endereço foi alterado, re-geocodificando...');
        const resultado = await geocodificarEndereco({
          cep: formData.cep,
          rua: formData.street,
          numero: formData.number,
          bairro: formData.neighborhood,
          cidade: formData.city,
          estado: formData.state
        });

        if (!resultado.sucesso || !resultado.coordenadas) {
          alert('❌ Não foi possível obter as coordenadas!\n\nNão conseguimos localizar este endereço no mapa. Verifique se o CEP e endereço estão corretos.');
          setLoading(false);
          return;
        }

        latitude = resultado.coordenadas.latitude;
        longitude = resultado.coordenadas.longitude;
        console.log(`✅ Novas coordenadas obtidas: [${latitude}, ${longitude}]`);
      } else {
        // Se não mudou o endereço mas não tem coordenadas, geocodificar
        if (!latitude || !longitude) {
          console.log('🔄 Cadastro sem coordenadas, geocodificando...');
          const resultado = await geocodificarEndereco({
            cep: formData.cep,
            rua: formData.street,
            numero: formData.number,
            bairro: formData.neighborhood,
            cidade: formData.city,
            estado: formData.state
          });

          if (resultado.sucesso && resultado.coordenadas) {
            latitude = resultado.coordenadas.latitude;
            longitude = resultado.coordenadas.longitude;
            console.log(`✅ Coordenadas obtidas: [${latitude}, ${longitude}]`);
          }
        }
      }

      // Validar que tem coordenadas antes de salvar
      if (!latitude || !longitude) {
        alert('❌ Cadastro sem coordenadas!\n\nNão foi possível obter as coordenadas. O cadastro não pode ser salvo sem localização no mapa.');
        setLoading(false);
        return;
      }

      await cadastrosService.atualizar(editingCadastro.id, {
        lideranca_id: formData.vinculoTipo === 'lideranca' ? formData.vinculoId : null,
        coordenador_id: formData.vinculoTipo === 'coordenador' ? formData.vinculoId : null,
        nome: formData.name,
        data_nascimento: formData.birthdate,
        telefone: formData.phone,
        email: formData.email || null,
        cep: formData.cep,
        endereco: formData.street,
        numero: formData.number || null,
        bairro: formData.neighborhood,
        cidade: formData.city,
        estado: formData.state,
        latitude,
        longitude,
      });

      await carregarDados();
      setShowEditModal(false);
      setEditingCadastro(null);
      setFormData({ name: '', phone: '', email: '', birthdate: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '', vinculoTipo: '', vinculoId: '' });
      alert('✅ Cadastro atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar cadastro:', error);
      alert('❌ Erro ao atualizar cadastro!\n\nOcorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Re-geocodificar todos os cadastros com TomTom
  const reGeocodificarTodos = async () => {
    if (!confirm('Isso irá atualizar as coordenadas de todos os cadastros usando TomTom. Continuar?')) return;

    setReGeocodificando(true);
    let atualizados = 0;
    let erros = 0;

    for (const cad of cadastros) {
      if (!cad.endereco || !cad.cidade) continue;

      try {
        const novasCoordenadas = await reGeocodificarRegistro({
          endereco: cad.endereco,
          numero: cad.numero,
          bairro: cad.bairro,
          cidade: cad.cidade,
          estado: cad.estado,
          cep: cad.cep
        });

        if (novasCoordenadas) {
          await cadastrosService.atualizar(cad.id, {
            latitude: novasCoordenadas.latitude,
            longitude: novasCoordenadas.longitude
          });
          atualizados++;
        }
      } catch (error) {
        console.error(`Erro ao re-geocodificar ${cad.nome}:`, error);
        erros++;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    await carregarDados();
    setReGeocodificando(false);
    alert(`Re-geocodificação concluída!\n✅ Atualizados: ${atualizados}\n❌ Erros: ${erros}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-gray-900 dark:text-white tracking-tight mb-1">
            Cadastros
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
            {filteredData.length} registro(s) encontrado(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportarXLSX}
            disabled={filteredData.length === 0}
            className="group relative px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all duration-300 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40 hover:scale-105 disabled:hover:scale-100"
          >
            <div className="flex items-center gap-2">
              <Icon name="download" className="text-[18px]" />
              <span>Baixar XLSX</span>
            </div>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="group relative px-5 py-2.5 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white text-sm font-medium rounded-xl transition-all duration-300 shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-105"
          >
            <div className="flex items-center gap-2">
              <Icon name="add" className="text-[18px]" />
              <span>Novo Cadastro</span>
            </div>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Filtros */}
        <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] p-4 flex flex-col md:flex-row gap-4 shadow-sm">
          <div className="flex-1 relative">
            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
            />
          </div>

          <div className="flex gap-3">
            <select
              value={selectedLeader}
              onChange={(e) => setSelectedLeader(e.target.value)}
              className="px-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-white/20 transition-all cursor-pointer"
            >
              <option value="Todos" className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">Todas as Lideranças</option>
              {liderancas.map(lider => (
                <option key={lider.id} value={lider.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">{lider.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabela */}
        <div className="light:bg-white dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] backdrop-blur-sm rounded-2xl border light:border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="light:bg-gray-50 dark:bg-white/[0.02] border-b light:border-gray-200 dark:border-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Bairro</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Equipe</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Líder</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y light:divide-gray-200 dark:divide-white/[0.03]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-white rounded-full"></div>
                        <span className="text-gray-400">Carregando...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Icon name="person_off" className="text-4xl text-gray-500" />
                        <p className="text-gray-400">Nenhum cadastro encontrado</p>
                        <p className="text-xs text-gray-500">Clique em "Novo Cadastro" para começar</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((cad) => {
                    const lideranca = liderancas.find(l => l.id === cad.lideranca_id);
                    const equipe = lideranca ? equipes.find(e => e.id === lideranca.equipe_id) : null;
                    return (
                      <tr key={cad.id} className="light:hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium light:text-gray-900 dark:text-white">{cad.nome}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {cad.telefone && (
                              <a href={`tel:${cad.telefone}`} className="text-xs light:text-gray-600 dark:text-gray-400 light:hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1.5">
                                <Icon name="call" className="text-[14px]" />
                                {cad.telefone}
                              </a>
                            )}
                            {cad.email && (
                              <a href={`mailto:${cad.email}`} className="text-xs light:text-gray-600 dark:text-gray-500 light:hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1.5 truncate max-w-[180px]">
                                <Icon name="mail" className="text-[14px]" />
                                {cad.email}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-400">{cad.bairro || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs font-medium light:text-gray-900 dark:text-white">{equipe?.nome || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs light:text-gray-600 dark:text-gray-400">{lideranca?.nome || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-500">{cad.criado_em ? new Date(cad.criado_em).toLocaleDateString('pt-BR') : '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirModalEditar(cad);
                              }}
                              className="text-gray-500 hover:text-blue-500 transition-colors p-2"
                              title="Editar cadastro"
                            >
                              <Icon name="edit" className="text-[18px]" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirModalExcluir(cad.id, cad.nome);
                              }}
                              className="text-gray-500 hover:text-red-500 transition-colors p-2"
                              title="Excluir cadastro"
                            >
                              <Icon name="delete" className="text-[18px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl light:bg-gray-50 dark:bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                <Icon name="search_off" className="text-gray-500 text-2xl" />
              </div>
              <p className="text-gray-900 dark:text-white font-light mb-1">Nenhum cadastro encontrado</p>
              <p className="text-gray-600 dark:text-gray-500 text-xs font-light">Tente ajustar os filtros ou busca</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Novo Cadastro */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="light:bg-white dark:bg-gradient-to-br dark:from-[#1a1f2e] dark:to-[#151923] rounded-2xl border light:border-gray-200 dark:border-white/10 max-w-2xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b light:border-gray-200 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium light:text-gray-900 dark:text-white tracking-tight">Novo Cadastro</h3>
                <p className="text-xs light:text-gray-600 dark:text-gray-400 mt-1 font-light">Adicione um novo cadastro ao sistema</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="light:text-gray-600 dark:text-gray-400 light:hover:text-gray-900 dark:hover:text-white transition-colors p-2 light:hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Maria Silva"
                      className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Telefone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Icon name="call" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      CEP <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Icon name="location_on" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        required
                        value={formData.cep}
                        onChange={handleCepChange}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                      {loadingCep && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Data de Nascimento <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="cake" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="date"
                      required
                      value={formData.birthdate}
                      onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Rua
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 relative">
                      <Icon name="signpost" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        placeholder="Preencha ou busque pelo CEP"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Icon name="pin" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        placeholder="Nº"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Bairro
                    </label>
                    <div className="relative">
                      <Icon name="home" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        placeholder="Preencha ou busque pelo CEP"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Cidade
                    </label>
                    <div className="relative">
                      <Icon name="location_city" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Preencha ou busque pelo CEP"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative">
                    <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Ex: maria@email.com"
                      className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Vincular a <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, vinculoTipo: 'lideranca', vinculoId: '' })}
                      className={`px-4 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${formData.vinculoTipo === 'lideranca'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'light:bg-gray-50 dark:bg-white/[0.03] light:border-gray-300 dark:border-white/10 light:text-gray-700 dark:text-gray-300 hover:border-blue-500'
                        }`}
                    >
                      <Icon name="person" className="text-[18px]" />
                      <span>Liderança</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, vinculoTipo: 'coordenador', vinculoId: '' })}
                      className={`px-4 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${formData.vinculoTipo === 'coordenador'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'light:bg-gray-50 dark:bg-white/[0.03] light:border-gray-300 dark:border-white/10 light:text-gray-700 dark:text-gray-300 hover:border-blue-500'
                        }`}
                    >
                      <Icon name="supervisor_account" className="text-[18px]" />
                      <span>Coordenador</span>
                    </button>
                  </div>
                </div>

                {formData.vinculoTipo && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {formData.vinculoTipo === 'lideranca' ? 'Liderança' : 'Coordenador'} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Icon name={formData.vinculoTipo === 'lideranca' ? 'person' : 'supervisor_account'} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <select
                        required
                        value={formData.vinculoId}
                        onChange={(e) => setFormData({ ...formData, vinculoId: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all cursor-pointer appearance-none"
                      >
                        <option value="" disabled className="bg-white dark:bg-[#1a1f2e] text-gray-400">
                          Selecione {formData.vinculoTipo === 'lideranca' ? 'uma liderança' : 'um coordenador'}
                        </option>
                        {formData.vinculoTipo === 'lideranca'
                          ? liderancas.map((lider) => (
                            <option key={lider.id} value={lider.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">{lider.nome}</option>
                          ))
                          : coordenadores.map((coord) => (
                            <option key={coord.id} value={coord.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">{coord.nome}</option>
                          ))
                        }
                      </select>
                      <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[18px]" />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2 border-t border-white/5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setFormData({ name: '', phone: '', email: '', birthdate: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '', vinculoTipo: '', vinculoId: '' });
                    }}
                    className="flex-1 px-5 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-700 dark:text-gray-300 light:hover:bg-gray-100 dark:hover:bg-white/[0.05] light:hover:text-gray-900 dark:hover:text-white transition-all font-light"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white font-medium rounded-xl transition-all shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <Icon name="check" className="text-[18px]" />
                    Criar Cadastro
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Cadastro */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowEditModal(false);
            setEditingCadastro(null);
          }}
        >
          <div
            className="light:bg-white dark:bg-gradient-to-br dark:from-[#1a1f2e] dark:to-[#151923] rounded-2xl border light:border-gray-200 dark:border-white/10 max-w-2xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b light:border-gray-200 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium light:text-gray-900 dark:text-white tracking-tight">Editar Cadastro</h3>
                <p className="text-xs light:text-gray-600 dark:text-gray-400 mt-1 font-light">Atualize as informações do cadastro</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCadastro(null);
                }}
                className="light:text-gray-600 dark:text-gray-400 light:hover:text-gray-900 dark:hover:text-white transition-colors p-2 light:hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Maria Silva"
                      className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Telefone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Icon name="call" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      CEP <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Icon name="location_on" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        required
                        value={formData.cep}
                        onChange={handleCepChange}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                      {loadingCep && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Data de Nascimento <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon name="cake" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="date"
                      required
                      value={formData.birthdate}
                      onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Rua
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 relative">
                      <Icon name="signpost" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        placeholder="Preencha ou busque pelo CEP"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Icon name="pin" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        placeholder="Nº"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Bairro
                    </label>
                    <div className="relative">
                      <Icon name="home" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        placeholder="Preencha ou busque pelo CEP"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Cidade
                    </label>
                    <div className="relative">
                      <Icon name="location_city" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Preencha ou busque pelo CEP"
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative">
                    <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Ex: maria@email.com"
                      className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Vincular a <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, vinculoTipo: 'lideranca', vinculoId: '' })}
                      className={`px-4 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${formData.vinculoTipo === 'lideranca'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'light:bg-gray-50 dark:bg-white/[0.03] light:border-gray-300 dark:border-white/10 light:text-gray-700 dark:text-gray-300 hover:border-blue-500'
                        }`}
                    >
                      <Icon name="person" className="text-[18px]" />
                      <span>Liderança</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, vinculoTipo: 'coordenador', vinculoId: '' })}
                      className={`px-4 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${formData.vinculoTipo === 'coordenador'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'light:bg-gray-50 dark:bg-white/[0.03] light:border-gray-300 dark:border-white/10 light:text-gray-700 dark:text-gray-300 hover:border-blue-500'
                        }`}
                    >
                      <Icon name="supervisor_account" className="text-[18px]" />
                      <span>Coordenador</span>
                    </button>
                  </div>
                </div>

                {formData.vinculoTipo && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {formData.vinculoTipo === 'lideranca' ? 'Liderança' : 'Coordenador'} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Icon name={formData.vinculoTipo === 'lideranca' ? 'person' : 'supervisor_account'} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]" />
                      <select
                        required
                        value={formData.vinculoId}
                        onChange={(e) => setFormData({ ...formData, vinculoId: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-white/20 light:focus:bg-white dark:focus:bg-white/[0.05] transition-all cursor-pointer appearance-none"
                      >
                        <option value="" disabled className="bg-white dark:bg-[#1a1f2e] text-gray-400">
                          Selecione {formData.vinculoTipo === 'lideranca' ? 'uma liderança' : 'um coordenador'}
                        </option>
                        {formData.vinculoTipo === 'lideranca'
                          ? liderancas.map((lider) => (
                            <option key={lider.id} value={lider.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">{lider.nome}</option>
                          ))
                          : coordenadores.map((coord) => (
                            <option key={coord.id} value={coord.id} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white">{coord.nome}</option>
                          ))
                        }
                      </select>
                      <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[18px]" />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2 border-t border-white/5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingCadastro(null);
                      setFormData({ name: '', phone: '', email: '', birthdate: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '', vinculoTipo: '', vinculoId: '' });
                    }}
                    className="flex-1 px-5 py-3 light:bg-gray-50 dark:bg-white/[0.03] border light:border-gray-300 dark:border-white/10 rounded-xl light:text-gray-700 dark:text-gray-300 light:hover:bg-gray-100 dark:hover:bg-white/[0.05] light:hover:text-gray-900 dark:hover:text-white transition-all font-light"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#1e5a8d] hover:from-[#1e4976] hover:to-[#2563eb] text-white font-medium rounded-xl transition-all shadow-lg shadow-[#1e3a5f]/25 hover:shadow-[#1e5a8d]/40 hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <Icon name="check" className="text-[18px]" />
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
        onConfirm={confirmarExclusao}
        title="Excluir Cadastro"
        message={`Tem certeza que deseja excluir o cadastro "${deleteTarget?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        loading={deleting}
      />
    </div>
  );
};

export default Registrations;
