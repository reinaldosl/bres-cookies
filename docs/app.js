const SUPABASE_URL = 'https://ulrkwzijqaejqrpzgkwq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscmt3emlqcWFlanFycHpna3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODY0ODgsImV4cCI6MjA5NDM2MjQ4OH0.rPIP3ZNcF70JqK1sTbehN4Vjqf2rPVcS-YwC2_tglRE'

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Utilitários ───────────────────────────────────────────────────

const fmt = {
  moeda: v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`,
  data:  v => new Date(v + 'T12:00:00').toLocaleDateString('pt-BR'),
  mes:   (ano, mes) => new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
}

function hoje() {
  return new Date().toISOString().split('T')[0]
}

function inicioMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function fimMes() {
  const d = new Date()
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return fim.toISOString().split('T')[0]
}

// ── Autenticação ──────────────────────────────────────────────────

const telaLogin = document.getElementById('tela-login')
const telaDash  = document.getElementById('tela-dashboard')
const formLogin = document.getElementById('form-login')
const msgErro   = document.getElementById('msg-erro')
const btnEntrar = document.getElementById('btn-entrar')
const btnSair   = document.getElementById('btn-sair')

sb.auth.onAuthStateChange((event, session) => {
  if (session) {
    telaLogin.style.display = 'none'
    telaDash.style.display  = 'block'
    carregarDados()
  } else {
    telaLogin.style.display = 'flex'
    telaDash.style.display  = 'none'
  }
})

formLogin.addEventListener('submit', async e => {
  e.preventDefault()
  msgErro.textContent   = ''
  btnEntrar.textContent = 'Entrando...'
  btnEntrar.disabled    = true

  const { error } = await sb.auth.signInWithPassword({
    email:    document.getElementById('email').value,
    password: document.getElementById('senha').value,
  })

  if (error) {
    msgErro.textContent   = 'E-mail ou senha inválidos.'
    btnEntrar.textContent = 'Entrar'
    btnEntrar.disabled    = false
  }
})

btnSair.addEventListener('click', () => sb.auth.signOut())

// ── Navegação lateral ─────────────────────────────────────────────

const sidebar       = document.getElementById('sidebar')
const sidebarOverlay = document.getElementById('sidebar-overlay')
const btnMenu       = document.getElementById('btn-menu')
const topbarTitulo  = document.getElementById('topbar-titulo')

const nomesPagina = {
  painel:  'Painel',
  compras: 'Compras de Estoque',
  vendas:  'Vendas',
}

function navegarPara(nome) {
  document.getElementById('pagina-painel').style.display  = nome === 'painel'  ? 'block' : 'none'
  document.getElementById('pagina-compras').style.display = nome === 'compras' ? 'block' : 'none'
  document.getElementById('pagina-vendas').style.display  = nome === 'vendas'  ? 'block' : 'none'

  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.classList.toggle('ativo', btn.dataset.pagina === nome)
  })

  topbarTitulo.textContent = nomesPagina[nome]
  fecharSidebar()

  if (nome === 'compras') carregarPaginaCompras()
  if (nome === 'vendas')  carregarPaginaVendas()
}

document.querySelectorAll('.sidebar-item').forEach(btn => {
  btn.addEventListener('click', () => navegarPara(btn.dataset.pagina))
})

function fecharSidebar() {
  sidebar.classList.remove('aberta')
  sidebarOverlay.classList.remove('visivel')
}

btnMenu.addEventListener('click', () => {
  const aberta = sidebar.classList.contains('aberta')
  sidebar.classList.toggle('aberta', !aberta)
  sidebarOverlay.classList.toggle('visivel', !aberta)
})

sidebarOverlay.addEventListener('click', fecharSidebar)

// ── Filtro de datas ───────────────────────────────────────────────

let filtroDataInicio = null
let filtroDataFim    = null

const inputFiltroDE  = document.getElementById('filtro-de')
const inputFiltroAte = document.getElementById('filtro-ate')
const btnFiltrar     = document.getElementById('btn-filtrar')
const btnLimpar      = document.getElementById('btn-limpar')
const filtroInfo     = document.getElementById('filtro-info')
const tituloVendas   = document.getElementById('titulo-vendas')

btnFiltrar.addEventListener('click', () => {
  filtroDataInicio = inputFiltroDE.value  || null
  filtroDataFim    = inputFiltroAte.value || null
  carregarUltimasVendas()
})

btnLimpar.addEventListener('click', () => {
  inputFiltroDE.value  = ''
  inputFiltroAte.value = ''
  filtroDataInicio     = null
  filtroDataFim        = null
  carregarUltimasVendas()
})

// ── Dados do Painel ───────────────────────────────────────────────

async function carregarDados() {
  await Promise.all([
    carregarMetricasDia(),
    carregarMetricasMes(),
    carregarRanking(),
    carregarUltimasVendas(),
    carregarCustos(),
  ])
}

async function carregarMetricasDia() {
  const dataHoje = hoje()
  const { data } = await sb.from('vendas')
    .select('quantidade, total, sabor')
    .eq('data', dataHoje)

  const unidades    = data?.reduce((s, r) => s + r.quantidade, 0) ?? 0
  const faturamento = data?.reduce((s, r) => s + Number(r.total), 0) ?? 0
  const sabores     = new Set(data?.map(r => r.sabor)).size

  document.getElementById('dia-unidades').textContent    = unidades
  document.getElementById('dia-faturamento').textContent = fmt.moeda(faturamento)
  document.getElementById('dia-sabores').textContent     = sabores
  document.getElementById('dia-data').textContent        = fmt.data(dataHoje)
}

async function carregarMetricasMes() {
  const { data } = await sb.from('vendas')
    .select('quantidade, total')
    .gte('data', inicioMes())
    .lte('data', fimMes())

  const unidades    = data?.reduce((s, r) => s + r.quantidade, 0) ?? 0
  const faturamento = data?.reduce((s, r) => s + Number(r.total), 0) ?? 0
  const nVendas     = data?.length ?? 0
  const ticket      = nVendas > 0 ? faturamento / nVendas : 0

  const d = new Date()
  document.getElementById('mes-unidades').textContent    = unidades
  document.getElementById('mes-faturamento').textContent = fmt.moeda(faturamento)
  document.getElementById('mes-ticket').textContent      = fmt.moeda(ticket)
  document.getElementById('mes-periodo').textContent     = fmt.mes(d.getFullYear(), d.getMonth() + 1)
}

async function carregarRanking() {
  const { data } = await sb.from('vendas')
    .select('sabor, quantidade, total')
    .gte('data', inicioMes())
    .lte('data', fimMes())

  const ranking = Object.values(
    (data ?? []).reduce((acc, r) => {
      if (!acc[r.sabor]) acc[r.sabor] = { sabor: r.sabor, quantidade: 0, faturamento: 0 }
      acc[r.sabor].quantidade  += r.quantidade
      acc[r.sabor].faturamento += Number(r.total)
      return acc
    }, {})
  ).sort((a, b) => b.quantidade - a.quantidade)

  const lista = document.getElementById('lista-ranking')

  if (!ranking.length) {
    lista.innerHTML = '<li class="vazio">Nenhuma venda registrada este mês.</li>'
    return
  }

  lista.innerHTML = ranking.map((item, i) => `
    <li class="item-ranking">
      <span class="rank-pos">${i + 1}</span>
      <div class="rank-info">
        <div class="rank-nome">${item.sabor}</div>
        <div class="rank-sub">${item.quantidade} unidades vendidas</div>
      </div>
      <span class="rank-fat">${fmt.moeda(item.faturamento)}</span>
    </li>
  `).join('')
}

async function carregarUltimasVendas() {
  const tbody = document.getElementById('tabela-vendas')
  tbody.innerHTML = '<tr><td colspan="5" class="vazio loading">Carregando...</td></tr>'

  const filtroAtivo = filtroDataInicio || filtroDataFim

  let query = sb.from('vendas')
    .select('data, sabor, quantidade, preco_unitario, total')
    .order('criado_em', { ascending: false })

  if (filtroDataInicio) query = query.gte('data', filtroDataInicio)
  if (filtroDataFim)    query = query.lte('data', filtroDataFim)
  if (!filtroAtivo)     query = query.limit(15)

  const { data } = await query

  if (filtroAtivo) {
    const partes = []
    if (filtroDataInicio) partes.push(`de ${fmt.data(filtroDataInicio)}`)
    if (filtroDataFim)    partes.push(`até ${fmt.data(filtroDataFim)}`)
    tituloVendas.textContent = `Vendas ${partes.join(' ')}`
    filtroInfo.textContent   = `${data?.length ?? 0} registro${(data?.length ?? 0) !== 1 ? 's' : ''} encontrado${(data?.length ?? 0) !== 1 ? 's' : ''}`
    btnLimpar.classList.add('visivel')
  } else {
    tituloVendas.textContent = 'Últimas vendas registradas'
    filtroInfo.textContent   = ''
    btnLimpar.classList.remove('visivel')
  }

  if (!data?.length) {
    const msg = filtroAtivo ? 'Nenhuma venda encontrada para o período selecionado.' : 'Nenhuma venda registrada ainda.'
    tbody.innerHTML = `<tr><td colspan="5" class="vazio">${msg}</td></tr>`
    return
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${fmt.data(r.data)}</td>
      <td><span class="badge-sabor">${r.sabor}</span></td>
      <td>${r.quantidade}</td>
      <td>${fmt.moeda(r.preco_unitario)}</td>
      <td><strong>${fmt.moeda(r.total)}</strong></td>
    </tr>
  `).join('')
}

async function carregarCustos() {
  const { data } = await sb.from('custos_por_sabor')
    .select('sabor, custo_fornada, qtd_produzida, custo_unitario, calculado_em')
    .order('calculado_em', { ascending: false })

  const recentes = Object.values(
    (data ?? []).reduce((acc, r) => {
      if (!acc[r.sabor]) acc[r.sabor] = r
      return acc
    }, {})
  )

  const tbody = document.getElementById('tabela-custos')

  if (!recentes.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="vazio">Nenhum custo calculado ainda.</td></tr>'
    return
  }

  tbody.innerHTML = recentes.map(r => `
    <tr>
      <td><span class="badge-sabor">${r.sabor}</span></td>
      <td>${fmt.moeda(r.custo_fornada)}</td>
      <td>${r.qtd_produzida} un.</td>
      <td><strong>${fmt.moeda(r.custo_unitario)}</strong></td>
      <td>${fmt.data(r.calculado_em.split('T')[0])}</td>
    </tr>
  `).join('')
}

// ── Compras de Estoque ────────────────────────────────────────────

async function carregarPaginaCompras() {
  await Promise.all([carregarTotalPorMes(), carregarCompras()])
}

async function carregarTotalPorMes() {
  const { data } = await sb.from('compras_estoque')
    .select('data_nota, total')
    .order('data_nota', { ascending: false })

  const grid = document.getElementById('grid-total-mes')

  if (!data?.length) {
    grid.innerHTML = '<div class="card-metrica"><div class="vazio">Nenhuma compra registrada ainda.</div></div>'
    return
  }

  const porMes = {}
  for (const r of data) {
    const chave = r.data_nota.slice(0, 7)
    if (!porMes[chave]) porMes[chave] = { total: 0, notas: 0 }
    porMes[chave].total += Number(r.total)
    porMes[chave].notas++
  }

  const meses = Object.entries(porMes)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)

  grid.innerHTML = meses.map(([chave, v]) => {
    const [ano, mes] = chave.split('-').map(Number)
    return `
      <div class="card-metrica">
        <div class="label">${fmt.mes(ano, mes)}</div>
        <div class="valor">${fmt.moeda(v.total)}</div>
        <div class="detalhe">${v.notas} nota${v.notas !== 1 ? 's' : ''} fiscal${v.notas !== 1 ? 'is' : ''}</div>
      </div>
    `
  }).join('')
}

async function carregarCompras() {
  const { data } = await sb.from('compras_estoque')
    .select('data_nota, fornecedor, numero_nota, arquivo_nome, total')
    .order('criado_em', { ascending: false })
    .limit(20)

  const tbody = document.getElementById('tabela-compras')

  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="vazio">Nenhuma compra registrada ainda. Envie uma nota fiscal acima.</td></tr>'
    return
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${fmt.data(r.data_nota)}</td>
      <td><strong>${r.fornecedor}</strong></td>
      <td>${r.numero_nota ?? '—'}</td>
      <td><span class="badge-sabor">${r.arquivo_nome ?? '—'}</span></td>
      <td><strong>${fmt.moeda(r.total)}</strong></td>
    </tr>
  `).join('')
}

// ── Upload de Nota Fiscal ─────────────────────────────────────────

const uploadArea      = document.getElementById('upload-area')
const inputNota       = document.getElementById('input-nota')
const estadoUpload    = document.getElementById('estado-upload')
const estadoProc      = document.getElementById('estado-processando')
const estadoSucesso   = document.getElementById('estado-sucesso')
const estadoErro      = document.getElementById('estado-erro')
const notaResumo      = document.getElementById('nota-resumo')
const msgErroUpload   = document.getElementById('msg-erro-upload')

document.getElementById('upload-link').addEventListener('click', e => {
  e.stopPropagation()
  inputNota.click()
})

uploadArea.addEventListener('click', () => inputNota.click())

inputNota.addEventListener('change', () => {
  if (inputNota.files[0]) processarNota(inputNota.files[0])
})

uploadArea.addEventListener('dragover', e => {
  e.preventDefault()
  uploadArea.classList.add('arrastando')
})

uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('arrastando'))

uploadArea.addEventListener('drop', e => {
  e.preventDefault()
  uploadArea.classList.remove('arrastando')
  if (e.dataTransfer.files[0]) processarNota(e.dataTransfer.files[0])
})

document.getElementById('btn-nova-nota').addEventListener('click', resetarUpload)
document.getElementById('btn-tentar-novamente').addEventListener('click', resetarUpload)

function mostrarEstado(nome) {
  estadoUpload.style.display  = nome === 'upload'      ? '' : 'none'
  estadoProc.style.display    = nome === 'processando' ? '' : 'none'
  estadoSucesso.style.display = nome === 'sucesso'     ? '' : 'none'
  estadoErro.style.display    = nome === 'erro'        ? '' : 'none'
}

function resetarUpload() {
  inputNota.value = ''
  mostrarEstado('upload')
}

async function processarNota(file) {
  mostrarEstado('processando')

  try {
    const { data: sessionData } = await sb.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Sessão expirada. Faça login novamente.')

    const form = new FormData()
    form.append('file', file)

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/processar-nota`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    form,
    })

    const json = await resp.json()
    if (!resp.ok || json.error) throw new Error(json.error ?? 'Erro ao processar a nota fiscal.')

    const d = json.data
    notaResumo.innerHTML = `
      <div><strong>Fornecedor:</strong> ${d.fornecedor}</div>
      <div><strong>Data:</strong> ${fmt.data(d.data_nota)}</div>
      ${d.numero_nota ? `<div><strong>Nº Nota:</strong> ${d.numero_nota}</div>` : ''}
      <div><strong>Total:</strong> ${fmt.moeda(d.total)}</div>
    `
    mostrarEstado('sucesso')

    await Promise.all([carregarTotalPorMes(), carregarCompras()])
  } catch (err) {
    msgErroUpload.textContent = err.message
    mostrarEstado('erro')
  }
}

// ── CRUD de Vendas ────────────────────────────────────────────────

const vendasMap = {}         // id → venda object para acesso nos botões inline
let   vendaEditando = null   // objeto da venda em edição (null = nova)
let   idExcluindo   = null   // id da venda a excluir

// ── Página ────────────────────────────────────────────

async function carregarPaginaVendas() {
  await Promise.all([carregarVendasCrud(), carregarSaboresLista()])
}

async function carregarVendasCrud() {
  const tbody = document.getElementById('tabela-vendas-crud')
  tbody.innerHTML = '<tr><td colspan="6" class="vazio loading">Carregando...</td></tr>'

  const { data, error } = await sb.from('vendas')
    .select('id, data, sabor, quantidade, preco_unitario, total')
    .order('data',      { ascending: false })
    .order('criado_em', { ascending: false })

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="vazio">Erro ao carregar: ${error.message}</td></tr>`
    return
  }

  const contagem = document.getElementById('vendas-contagem')
  contagem.textContent = data?.length ? `${data.length} registro${data.length !== 1 ? 's' : ''}` : ''

  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="vazio">Nenhuma venda registrada. Clique em "+ Nova Venda" para começar.</td></tr>'
    return
  }

  data.forEach(r => { vendasMap[r.id] = r })

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${fmt.data(r.data)}</td>
      <td><span class="badge-sabor">${r.sabor}</span></td>
      <td>${r.quantidade}</td>
      <td>${fmt.moeda(r.preco_unitario)}</td>
      <td><strong>${fmt.moeda(r.total)}</strong></td>
      <td class="col-acoes">
        <button class="btn-icone editar"  title="Editar"  onclick="abrirEdicaoVenda(vendasMap[${r.id}])">✏️</button>
        <button class="btn-icone excluir" title="Excluir" onclick="confirmarExclusaoVenda(${r.id})">🗑️</button>
      </td>
    </tr>
  `).join('')
}

async function carregarSaboresLista() {
  const { data } = await sb.from('vendas').select('sabor')
  const unicos = [...new Set(data?.map(r => r.sabor) ?? [])]
  document.getElementById('lista-sabores').innerHTML = unicos.map(s => `<option value="${s}">`).join('')
}

// ── Modal helpers ─────────────────────────────────────

function abrirModal(id) {
  document.getElementById(id).classList.add('aberto')
  document.body.style.overflow = 'hidden'
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('aberto')
  document.body.style.overflow = ''
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) fecharModal(overlay.id)
  })
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    fecharModal('modal-venda')
    fecharModal('modal-excluir')
  }
})

// ── Formulário criar / editar ─────────────────────────

const vData  = document.getElementById('v-data')
const vSabor = document.getElementById('v-sabor')
const vQtd   = document.getElementById('v-quantidade')
const vPreco = document.getElementById('v-preco')

function calcularTotal() {
  const qty   = parseFloat(vQtd.value)   || 0
  const price = parseFloat(vPreco.value) || 0
  document.getElementById('v-total-preview').textContent = fmt.moeda(qty * price)
}

vQtd.addEventListener('input',   calcularTotal)
vPreco.addEventListener('input',  calcularTotal)

function abrirNovaVenda() {
  vendaEditando = null
  document.getElementById('modal-venda-titulo').textContent = 'Nova Venda'
  document.getElementById('form-venda').reset()
  document.getElementById('form-venda-erro').textContent = ''
  vData.value = hoje()
  calcularTotal()
  carregarSaboresLista()
  abrirModal('modal-venda')
  setTimeout(() => vSabor.focus(), 150)
}

function abrirEdicaoVenda(venda) {
  vendaEditando = venda
  document.getElementById('modal-venda-titulo').textContent = 'Editar Venda'
  document.getElementById('form-venda-erro').textContent = ''
  vData.value  = venda.data
  vSabor.value = venda.sabor
  vQtd.value   = venda.quantidade
  vPreco.value = venda.preco_unitario
  calcularTotal()
  abrirModal('modal-venda')
}

document.getElementById('btn-nova-venda').addEventListener('click', abrirNovaVenda)
document.getElementById('btn-fechar-modal-venda').addEventListener('click', () => fecharModal('modal-venda'))
document.getElementById('btn-cancelar-venda').addEventListener('click',     () => fecharModal('modal-venda'))

document.getElementById('form-venda').addEventListener('submit', async e => {
  e.preventDefault()

  const erroEl = document.getElementById('form-venda-erro')
  erroEl.textContent = ''

  const sabor = vSabor.value.trim()
  const qty   = parseInt(vQtd.value)
  const price = parseFloat(vPreco.value)

  if (!sabor)           { erroEl.textContent = 'Informe o sabor.';          return }
  if (!qty   || qty < 1){ erroEl.textContent = 'Quantidade mínima é 1.';    return }
  if (!price || price < 0){ erroEl.textContent = 'Preço inválido.';         return }

  const btn = document.getElementById('btn-salvar-venda')
  btn.textContent = 'Salvando...'
  btn.disabled    = true

  const payload = {
    data:           vData.value,
    sabor,
    quantidade:     qty,
    preco_unitario: price,
    total:          qty * price,
  }

  const { error } = vendaEditando
    ? await sb.from('vendas').update(payload).eq('id', vendaEditando.id)
    : await sb.from('vendas').insert(payload)

  btn.textContent = 'Salvar'
  btn.disabled    = false

  if (error) {
    erroEl.textContent = 'Erro ao salvar: ' + error.message
    return
  }

  fecharModal('modal-venda')
  carregarVendasCrud()
  carregarSaboresLista()
  carregarDados() // atualiza métricas do Painel em background
})

// ── Exclusão ──────────────────────────────────────────

function confirmarExclusaoVenda(id) {
  idExcluindo = id
  const v = vendasMap[id]
  document.getElementById('excluir-resumo').innerHTML = v ? `
    <div><strong>Data:</strong> ${fmt.data(v.data)}</div>
    <div><strong>Sabor:</strong> ${v.sabor}</div>
    <div><strong>Total:</strong> ${fmt.moeda(v.total)}</div>
  ` : ''
  abrirModal('modal-excluir')
}

document.getElementById('btn-cancelar-excluir').addEventListener('click', () => fecharModal('modal-excluir'))

document.getElementById('btn-confirmar-excluir').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirmar-excluir')
  btn.textContent = 'Excluindo...'
  btn.disabled    = true

  const { error } = await sb.from('vendas').delete().eq('id', idExcluindo)

  btn.textContent = 'Excluir'
  btn.disabled    = false
  idExcluindo     = null

  if (error) {
    alert('Erro ao excluir: ' + error.message)
    return
  }

  fecharModal('modal-excluir')
  carregarVendasCrud()
  carregarDados() // atualiza métricas do Painel em background
})
