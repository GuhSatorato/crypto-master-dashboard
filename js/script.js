// Configurações
const COIN_API_URL = 'https://api.coinpaprika.com/v1/tickers?limit=100'; 
const CURRENCY_API_URL = 'https://economia.awesomeapi.com.br/last/USD-BRL';
const FEAR_GREED_API_URL = 'https://api.alternative.me/fng/';

// Estado Global
let allCoinsData = [];
let dollarRate = 5.80; // Fallback
let myChart = null;

// === 1. Inicialização ===
async function initDashboard() {
    try {
        await Promise.all([fetchDollarRate(), fetchFearAndGreed()]);

        const response = await fetch(COIN_API_URL);
        if (!response.ok) throw new Error("Erro API Cripto");
        const data = await response.json();

        // Sanitização de dados
        allCoinsData = data.map(coin => ({
            id: coin.id,
            name: coin.name,
            symbol: coin.symbol,
            priceUsd: parseFloat(coin.quotes.USD.price),
            changePercent: parseFloat(coin.quotes.USD.percent_change_24h || 0)
        }));

        // Renderização dos Componentes
        renderTicker(allCoinsData);
        renderList(allCoinsData);
        populateSelects(allCoinsData); // Preenche Select da Calculadora E do Gráfico
        updateChart(allCoinsData[0]);  // Bitcoin
        
        loadSavedData();

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao carregar dados. Verifique a conexão.");
    }
}

// === 2. APIs Auxiliares ===
async function fetchDollarRate() {
    try {
        const res = await fetch(CURRENCY_API_URL);
        const data = await res.json();
        dollarRate = parseFloat(data.USDBRL.bid);
    } catch (e) { console.warn("Usando dólar fallback"); }
}

async function fetchFearAndGreed() {
    try {
        const res = await fetch(FEAR_GREED_API_URL);
        const data = await res.json();
        const item = data.data[0];
        
        document.getElementById('fng-value').innerText = `${item.value} (${item.value_classification})`;
        
        const bar = document.getElementById('fng-bar');
        bar.style.width = `${item.value}%`;
        
        if(item.value < 25) bar.style.backgroundColor = '#ef4444';
        else if(item.value < 50) bar.style.backgroundColor = '#f59e0b';
        else if(item.value < 75) bar.style.backgroundColor = '#3b82f6';
        else bar.style.backgroundColor = '#10b981';
    } catch (e) { document.getElementById('fng-value').innerText = "N/A"; }
}

// === 3. Renderização UI ===
function renderTicker(coins) {
    const container = document.getElementById('ticker-content');
    const top20 = coins.slice(0, 20);
    const html = top20.map(c => {
        const color = c.changePercent >= 0 ? 'ticker-up' : 'ticker-down';
        const symbol = c.changePercent >= 0 ? '▲' : '▼';
        return `<div class="ticker-item"><strong>${c.symbol}</strong> $${c.priceUsd.toFixed(2)} <span class="${color}">(${symbol} ${c.changePercent.toFixed(2)}%)</span></div>`;
    }).join('');
    container.innerHTML = html + html; // Loop infinito visual
}

function renderList(coins) {
    const list = document.getElementById('top-coins-list');
    const display = coins.slice(0, 50);

    if(display.length === 0) { list.innerHTML = '<li style="padding:15px">Nada encontrado.</li>'; return; }

    list.innerHTML = display.map(c => {
        const priceBrl = c.priceUsd * dollarRate;
        const changeClass = c.changePercent >= 0 ? 'positive' : 'negative';
        return `
            <li class="coin-item" onclick="selectCoin('${c.id}')">
                <div class="coin-name">${c.name} <small style="color:#64748b">(${c.symbol})</small></div>
                <div class="coin-prices">
                    <span class="price-brl">R$ ${priceBrl.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    <span class="price-usd">$${c.priceUsd.toFixed(2)} <span class="${changeClass}">${c.changePercent.toFixed(2)}%</span></span>
                </div>
            </li>
        `;
    }).join('');
}

// === 4. Controles e Selects ===
function populateSelects(coins) {
    const calcSelect = document.getElementById('crypto-select');
    const chartSelect = document.getElementById('main-chart-select');
    
    const options = coins.map(c => `<option value="${c.id}">${c.name} (${c.symbol})</option>`).join('');
    
    calcSelect.innerHTML = options;
    chartSelect.innerHTML = options;

    // Evento: Mudança no Select do Gráfico
    chartSelect.addEventListener('change', (e) => {
        const coin = allCoinsData.find(c => c.id === e.target.value);
        if(coin) updateChart(coin);
    });
}

function filterCoins() {
    const term = document.getElementById('search-input').value.toLowerCase();
    const filtered = allCoinsData.filter(c => c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term));
    renderList(filtered);
}

function selectCoin(id) {
    const coin = allCoinsData.find(c => c.id === id);
    if(coin) updateChart(coin);
}

// === 5. Calculadora ===
function calculateProfit() {
    const id = document.getElementById('crypto-select').value;
    const amount = parseFloat(document.getElementById('amount-input').value);
    const buyPrice = parseFloat(document.getElementById('buy-price-input').value);

    if (isNaN(amount) || isNaN(buyPrice)) { alert("Preencha os valores!"); return; }

    localStorage.setItem('portfolio', JSON.stringify({ id, amount, buyPrice }));

    const coin = allCoinsData.find(c => c.id === id);
    const currentTotalBrl = (amount * coin.priceUsd) * dollarRate;
    const initialTotalBrl = (amount * buyPrice) * dollarRate;
    const profit = currentTotalBrl - initialTotalBrl;

    document.getElementById('result-area').classList.add('visible');
    document.getElementById('current-value-brl').innerText = currentTotalBrl.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    const profitEl = document.getElementById('profit-value');
    profitEl.innerText = profit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    profitEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';
}

function loadSavedData() {
    const saved = JSON.parse(localStorage.getItem('portfolio'));
    if(saved) {
        document.getElementById('crypto-select').value = saved.id;
        document.getElementById('amount-input').value = saved.amount;
        document.getElementById('buy-price-input').value = saved.buyPrice;
        setTimeout(() => calculateProfit(), 500);
    }
}

function clearData() {
    localStorage.removeItem('portfolio');
    document.getElementById('amount-input').value = '';
    document.getElementById('buy-price-input').value = '';
    document.getElementById('result-area').classList.remove('visible');
}

// === 6. Gráfico ===
function updateChart(coin) {
    // Atualiza Select e Textos
    document.getElementById('main-chart-select').value = coin.id;
    const priceBrl = coin.priceUsd * dollarRate;
    document.getElementById('current-price-brl').innerText = priceBrl.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    document.getElementById('current-price-usd').innerText = `$ ${coin.priceUsd.toFixed(2)}`;

    // Simulação Gráfica
    const ctx = document.getElementById('coinChart').getContext('2d');
    const labels = ['Agora', '-1h', '-2h', '-3h', '-4h', '-5h'].reverse();
    const dataPoints = labels.map(() => coin.priceUsd * (1 + (Math.random() * 0.04 - 0.02)));

    if (myChart) myChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'USD',
                data: dataPoints,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: { display: false },
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

initDashboard();