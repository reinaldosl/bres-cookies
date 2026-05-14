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

const telaLogin     = document.getElementById('tela-login')
const telaDash      = document.getElementById('tela-dashboard')
const formLogin     = document.getElementById('form-login')
const msgErro       = document.getElementById('msg-erro')
const btnEntrar     = document.getElementById('btn-entrar')
const btnSair       = document.getElementById('btn-sair')

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
  msgErro.textContent    = ''
  btnEntrar.textContent  = 'Entrando...'
  btnEntrar.disabled     = true

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

// ── Dados do Dashboard ────────────────────────────────────────────

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

  const unidades   = data?.reduce((s, r) => s + r.quantidade, 0) ?? 0
  const faturamento = data?.reduce((s, r) => s + Number(r.total), 0) ?? 0
  const sabores    = new Set(data?.map(r => r.sabor)).size

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
  const { data } = await sb.from('vendas')
    .select('data, sabor, quantidade, preco_unitario, total')
    .order('criado_em', { ascending: false })
    .limit(15)

  const tbody = document.getElementById('tabela-vendas')

  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="vazio">Nenhuma venda registrada ainda.</td></tr>'
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

  // Mantém apenas o cálculo mais recente por sabor
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
