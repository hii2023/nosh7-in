(function() {
  
  const GROQ_URL = 'https://nosh7-chat.hiiiiii2023.workers.dev/';
  const WA = 'https://wa.me/919712989498';
  const WA_TEXT = t => WA + '?text=' + encodeURIComponent(t);

  let lang = 'en';
  let history = [];

  const SYSTEM_PROMPT = `You are Julie, a real person working at NOSH7 - Ahmedabad's pure veg salad cloud kitchen. Your job is to help customers find the right plan and nudge them towards ordering. Be warm, friendly, and direct - like a helpful friend who knows the product inside out.

RESPONSE RULES:
- Keep replies to 2-3 sentences max. Never write essays.
- Sound human and natural, not like a chatbot.
- Use **bold** for prices, days, protein values, savings, and key facts (e.g. **₹200/day**, **25 days**, **18-24g protein**).
- Always end with a soft push towards ordering or next step (e.g. "Want to start with the trial?" or "Grab it at nosh7.com/order").
- Never make up information. If unsure, say "WhatsApp us at **9712989498** and we'll sort it out!"
- Think like a salesperson - understand what the customer needs and give them the one best answer, not a list of options.

ABOUT NOSH7:
- Pure veg salad cloud kitchen in Ahmedabad. Fresh meals delivered daily.
- Jain options available on all plans.
- Contact: WhatsApp **9712989498** | Order: nosh7.com/order

PLANS & PRICING:
1. Trial Pack - **₹1,250 / 5 days** - use code **TRIAL** at checkout for ₹150 off → pay only **₹1,100** (**₹220/day**). One-time offer. No commitment, full refund if not happy.
2. Monthly Plan - **₹4,999 / 25 days** (**₹200/day**, 33% off, save **₹2,476**). Includes superfood seeds weekly, free nutrition consultation, pause anytime. [MOST POPULAR]

MENU & CUSTOMISATION:
- We have a monthly fixed menu that changes every month.
- Customers can customise any dish for just **₹49/meal** extra.
- To customise, WhatsApp us at **9712989498** before the delivery day.

HEALTH DRINKS: Chargeable at **₹29/day** add-on. No free weeks included.

ACTIVE OFFERS:
1. Double Cashback - buy 2 subscriptions = **5% cashback** each
2. Group Offer - 3+ people = up to **10% cashback**
3. Refer a Friend - both get **1 bowl** free
4. Loyalty Reward - 3 months in a row = **3 free meals** on next plan

HEALTH GOALS:
- Weight Loss: ~**350–420 kcal/bowl**, customers lose **3–7 kg** in 60 days
- High Protein (pure veg): **18–24g protein/bowl** from edamame, chickpeas, pumpkin seeds
- PCOD/PCOS: Anti-inflammatory, low glycaemic, no refined carbs
- Diabetes: Low GI, high fibre, zero added sugar
- Thyroid: Selenium-rich seeds, anti-inflammatory greens

ORDERING: nosh7.com/order (best price) | Zomato | Swiggy | WhatsApp **9712989498**

DELIVERY: West Ahmedabad - Satellite, Prahlad Nagar, Bodakdev, Vastrapur, Thaltej, Anandnagar, SG Highway, Ambli, Sindhu Bhavan Road. 4 daily batches.`;

  const LANG_PROMPT = {
    en: 'Reply in English only.',
    hi: 'Reply in Hindi (Devanagari script) only. Keep it natural and conversational.',
    gu: 'Reply in Gujarati only. Keep it natural and conversational.'
  };

  const QUICK_DEFAULTS = ['Plans & Pricing','Trial Pack','Place an Order','Delivery Areas','Health Goals','Active Offers'];

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function mdToHtml(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  function keywordFallback(text) {
    const t = text.toLowerCase();
    if (/\bhi\b|hello|namaste|hey|\bstart\b/.test(t))
      return `Hi! I'm Julie from NOSH7 🌿 We deliver fresh pure veg salad bowls in Ahmedabad - from **₹220/day** (trial, with code TRIAL) or **₹200/day** (monthly). What brings you here? Weight loss, high protein, or clean eating?`;
    if (/trial|5.?day|\btry\b|sample/.test(t))
      return `Our **Trial Pack** is **₹1,250 for 5 days**. Use code **TRIAL** at checkout → pay only **₹1,100** (**₹220/day**, 26% off). One-time offer. No commitment, full refund if not happy. Order at **nosh7.com/order** or WhatsApp **9712989498**.`;
    if (/26.?day|month|popular/.test(t))
      return `The **Monthly Plan** is **₹4,999 for 25 days** (₹200/day, 33% off, save **₹2,476**). Includes superfood seeds + nutrition consultation. Our most popular! Ready to start?`;
    if (/plan|pric|cost|rate|how.?much|kitna/.test(t))
      return `2 plans: **Trial ₹1,250/5 days** (code TRIAL = ₹1,100) | **Monthly ₹4,999/25 days** (most popular, ₹200/day). All fresh daily salad bowls. Which one suits you?`;
    if (/offer|discount|cashback|deal|promo/.test(t))
      return `**Active Offers:** Double Cashback (2 subs = 5% each) · Group Offer (3+ people = 10%) · Refer a Friend = 1 bowl each · Loyalty (3 months = 3 free meals). WhatsApp **9712989498** to avail!`;
    if (/deliver|area|zone|location|where|satellite|prahlad|bodakdev|vastrapur/.test(t))
      return `We cover West Ahmedabad - **Satellite, Prahlad Nagar, Bodakdev, Vastrapur, Thaltej, Anandnagar, SG Highway, Ambli, Sindhu Bhavan Road**. 4 daily batches. WhatsApp **9712989498** to confirm your area.`;
    if (/weight|loss|slim|fat|calorie|diet/.test(t))
      return `Our bowls are **350–420 kcal**, high fibre, zero junk. Customers lose **3–7 kg in 60 days**. The **Monthly Plan** is the best place to start - want to try it?`;
    if (/protein|muscle|gym|fitness/.test(t))
      return `Every bowl has **18–24g protein** from edamame, chickpeas & pumpkin seeds - 100% pure veg. Perfect for gym-goers. The **Monthly Plan** is ideal - want to go for it?`;
    if (/pcod|pcos|hormonal|thyroid/.test(t))
      return `Our meals are anti-inflammatory, low-glycaemic, no refined carbs - great for **PCOD & thyroid** health. WhatsApp **9712989498** and we'll design the right plan for you.`;
    if (/diabet|sugar|glyc/.test(t))
      return `Our bowls are **low GI, high fibre, zero added sugar** - ideal for diabetics. WhatsApp **9712989498** and our nutritionist will guide you.`;
    if (/order|buy|\bstart\b|subscri|book/.test(t))
      return `Easiest way: **nosh7.com/order** for best price, or WhatsApp **9712989498**. Also on Zomato & Swiggy. Start with the **Trial Pack (₹1,250 - use code TRIAL for ₹150 off)** - no risk!`;
    if (/customis|custom|change|dish|menu|jain/.test(t))
      return `Monthly fixed menu that rotates. Customise any dish for just **₹49/meal** extra - WhatsApp **9712989498** before the delivery day. Jain options on all plans!`;
    if (/drink|juice/.test(t))
      return `Health drinks are **₹29/day**. **Monthly Plan** includes 1 week free (worth ₹499). Great add-on!`;
    return `WhatsApp us at **9712989498** for instant help - we're very responsive! Or pick a question below 👇`;
  }

  async function askGemini(userText) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n' + LANG_PROMPT[lang] },
      ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : h.role, content: h.text })),
      { role: 'user', content: userText }
    ];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res;
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, temperature: 0.7, max_tokens: 180 }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('API error ' + res.status);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';
    history.push({ role: 'user', text: userText });
    history.push({ role: 'model', text: reply });
    if (history.length > 20) history = history.slice(-20);
    return reply;
  }

  // ── DOM helpers ──
  const msgs  = () => document.getElementById('julie-msgs');
  const quick = () => document.getElementById('julie-quick');

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const m = msgs();
      m.scrollTop = m.scrollHeight;
    });
  }

  function addMsg(html, role) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + role;
    if (role === 'bot') {
      wrap.innerHTML = `<div class="msg-avatar-sm"><img decoding="async" src="/assets/julie-face.webp?v=1" alt="Julie"></div><div class="msg-bubble">${html}</div>`;
    } else {
      wrap.innerHTML = `<div class="msg-bubble">${html}</div>`;
    }
    msgs().appendChild(wrap);
    scrollToBottom();
  }

  function setQuick(labels) {
    const q = quick();
    q.innerHTML = '';
    (labels || []).forEach(label => {
      const b = document.createElement('button');
      b.className = 'qr-btn';
      b.textContent = label;
      b.onclick = () => handleInput(label);
      q.appendChild(b);
    });
    scrollToBottom();
  }

  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';
    wrap.id = 'julie-typing';
    wrap.innerHTML = `<div class="msg-avatar-sm"><img decoding="async" src="/assets/julie-face.webp?v=1" alt="Julie"></div><div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    msgs().appendChild(wrap);
    scrollToBottom();
  }

  function removeTyping() {
    const t = document.getElementById('julie-typing');
    if (t) t.remove();
  }

  // ── ORDER FLOW ──
  let orderState = null;

  function startOrderFlow() {
    orderState = { step: 'plan', plan: null, slot: null, name: null, address: null };
    addMsg('Sure! Let me help you place your order in 4 quick steps 🌿<br><br><strong>Step 1:</strong> Which plan would you like?', 'bot');
    setQuick(['Trial Pack - ₹1,250 (use code TRIAL = ₹1,100)', 'Monthly Plan - ₹4,999 (25 days)']);
  }

  function handleOrderStep(text) {
    const t = text.toLowerCase();
    if (orderState.step === 'plan') {
      if (/trial|1.?250|1.?100|5.?day/.test(t)) orderState.plan = 'Trial Pack (5 days) - ₹1,250 (code TRIAL = ₹1,100)';
      else if (/25|4.?999|month/.test(t)) orderState.plan = 'Monthly Plan - ₹4,999 (25 days)';
      else { addMsg('Please pick one of the plans below 👇', 'bot'); setQuick(['Trial Pack - ₹1,250 (use code TRIAL = ₹1,100)', 'Monthly Plan - ₹4,999 (25 days)']); return; }
      orderState.step = 'slot';
      addMsg('Great choice! 🎉<br><br><strong>Step 2:</strong> Which delivery slot do you prefer? We have 4 daily batches:', 'bot');
      setQuick(['Morning - 9:30 to 11:30 AM', 'Lunch - 11:30 AM to 1:30 PM', 'Evening - 4:30 to 6:30 PM', 'Dinner - 6:30 to 8:30 PM']);
      return;
    }
    if (orderState.step === 'slot') {
      if (/9.?30|11.?30|morning/i.test(t)) orderState.slot = 'Morning - 9:30 AM to 11:30 AM';
      else if (/11.?30|1.?30|lunch/i.test(t)) orderState.slot = 'Lunch - 11:30 AM to 1:30 PM';
      else if (/4.?30|6.?30|evening/i.test(t)) orderState.slot = 'Evening - 4:30 PM to 6:30 PM';
      else if (/6.?30|8.?30|dinner/i.test(t)) orderState.slot = 'Dinner - 6:30 PM to 8:30 PM';
      else { addMsg('Please pick one of the 4 delivery slots below 👇', 'bot'); setQuick(['Morning - 9:30 to 11:30 AM', 'Lunch - 11:30 AM to 1:30 PM', 'Evening - 4:30 to 6:30 PM', 'Dinner - 6:30 to 8:30 PM']); return; }
      orderState.step = 'name';
      addMsg('Perfect! 😊<br><br><strong>Step 3:</strong> What\'s your name?', 'bot');
      setQuick([]);
      return;
    }
    if (orderState.step === 'name') {
      orderState.name = text.trim();
      orderState.step = 'address';
      addMsg(`Hi <strong>${escapeHtml(orderState.name)}</strong>! 👋<br><br><strong>Step 4:</strong> Please share your full delivery address.<br><span style="font-size:0.8em;color:#5a6b62;">Include flat/house no., building name, street, area, and landmark if any.</span>`, 'bot');
      setQuick([]);
      return;
    }
    if (orderState.step === 'address') {
      orderState.address = text.trim();
      const waMsg = `Hi Team NOSH7! 🌿\n\nI'd like to place an order:\n\n📦 Plan: ${orderState.plan}\n🕐 Slot: ${orderState.slot}\n👤 Name: ${orderState.name}\n📍 Address: ${orderState.address}\n\nPlease confirm availability and next steps!`;
      const waUrl = `https://wa.me/919712989498?text=${encodeURIComponent(waMsg)}`;
      addMsg(`🎉 <strong>Order Summary</strong><br><br>📦 ${orderState.plan}<br>🕐 ${orderState.slot}<br>👤 ${orderState.name}<br>📍 ${orderState.address}<br><br>Tap below to send this to our team on WhatsApp - we'll confirm and get you started! 🚀`, 'bot');
      const q = quick();
      q.innerHTML = '';
      const waBtn = document.createElement('a');
      waBtn.href = waUrl; waBtn.target = '_blank'; waBtn.rel = 'noopener';
      waBtn.className = 'qr-btn qr-wa';
      waBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Send Order on WhatsApp`;
      q.appendChild(waBtn);
      orderState = null;
      setTimeout(() => setQuick(QUICK_DEFAULTS), 10000);
      return;
    }
  }

  async function handleInput(text) {
    if (!text.trim()) return;
    addMsg(escapeHtml(text), 'user');
    document.getElementById('julie-input').value = '';
    quick().innerHTML = '';
    if (orderState !== null) { handleOrderStep(text); return; }
    const _t = text.trim().toLowerCase();
    if (_t === 'place an order' || _t === 'order now' || /place.{0,5}order/i.test(text)) { startOrderFlow(); return; }
    showTyping();
    try {
      const reply = await askGemini(text);
      removeTyping();
      addMsg(mdToHtml(reply), 'bot');
    } catch (e) {
      removeTyping();
      addMsg(mdToHtml(keywordFallback(text)), 'bot');
    }
    setQuick(QUICK_DEFAULTS);
  }

  // ── Language selector ──
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      lang = btn.dataset.lang;
    });
  });

  // ── Toggle ──
  let isOpen = false;
  let greeted = false;
  window.toggleJulie = function() {
    isOpen = !isOpen;
    document.getElementById('julie-window').classList.toggle('open', isOpen);
    document.getElementById('julie-badge').style.display = isOpen ? 'none' : 'flex';
    if (isOpen && !greeted) {
      greeted = true;
      setTimeout(() => {
        showTyping();
        setTimeout(() => {
          removeTyping();
          addMsg(`Namaste! 🌿 I'm <strong>Julie</strong>, your NOSH7 health assistant.<br><br>Ask me anything - plans, delivery, offers, or your health goals. I'm here to help!`, 'bot');
          setQuick(QUICK_DEFAULTS);
        }, 700);
      }, 300);
    }
  };

  // ── Send button & Enter key ──
  document.getElementById('julie-send').addEventListener('click', () => {
    handleInput(document.getElementById('julie-input').value);
  });
  document.getElementById('julie-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleInput(e.target.value);
  });
})();
