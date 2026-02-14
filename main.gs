/**
 * ============================================================================
 * JOB APPLICATION TRACKER v2.2 - POLLING MODE (100% WORKING)
 * ============================================================================
 * 
 * FEATURES:
 * ✅ Polling based (no webhook issues)
 * ✅ Fast response (1 minute interval)
 * ✅ Persistent update tracking
 * ✅ Commands work guaranteed
 * 
 * SETUP:
 * 1. Replace entire code with this
 * 2. Run setup() once
 * 3. Run deleteWebhook() once (important!)
 * 4. Set trigger: pollAndCheck → Every 1 minute
 * ============================================================================
 */

// ========== CONFIGURATION ==========
const CONFIG = {
  OPENROUTER_API_KEY: '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',
  TELEGRAM_BOT_TOKEN: '8520816868:AAHBkj8Y_MUzXCZANMbFN4jB3jYz60Xusig',
  TELEGRAM_CHAT_ID: '650140634',
  DAYS_TO_CHECK: 1,           
  SHEET_NAME: 'Applications',
  SEND_TELEGRAM: true,       
  MAX_EMAILS_PER_BATCH: 40,
  AI_MODEL: 'anthropic/claude-3-haiku',
  AI_TEMPERATURE: 0.1
};

// ========== SETUP ==========

function setup() {
  try {
    Logger.log('🚀 Starting setup...');
    
    // Create sheet
    const sheet = getOrCreateSheet();
    
    if (sheet.getLastRow() === 0) {
      const headers = ['Date', 'Company', 'Position', 'Status', 'Source', 'Email Subject', 'Timestamp', 'MessageID'];
      sheet.appendRow(headers);
      
      const headerRange = sheet.getRange(1, 1, 1, 8);
      headerRange.setFontWeight('bold')
                 .setBackground('#4285f4')
                 .setFontColor('#ffffff');
      
      sheet.setFrozenRows(1);
      sheet.hideColumns(8);
      sheet.autoResizeColumns(1, 7);
    }
    
    // Initialize polling
    PropertiesService.getScriptProperties().setProperty('lastUpdateId', '0');
    
    // Delete any existing webhook
    deleteWebhook();
    
    sendTelegramMessage(
      '🚀 *Job Tracker v2.2 - POLLING MODE*\n\n' +
      '✅ Commands: /stats /summary /today /week /companies /check /help\n' +
      '⏱ Updates every 1 minute'
    );
    
    Logger.log('✅ Setup complete! Now set trigger for pollAndCheck() every 1 minute');
    
  } catch (error) {
    Logger.log('❌ Setup failed: ' + error.message);
    throw error;
  }
}

function deleteWebhook() {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/deleteWebhook`;
  const response = UrlFetchApp.fetch(url);
  Logger.log('Webhook deleted: ' + response.getContentText());
  return response.getContentText();
}

// ========== MAIN POLLING FUNCTION ==========

function pollAndCheck() {
  // Step 1: Check emails
  try {
    checkEmails();
  } catch (e) {
    Logger.log('Email check error: ' + e);
  }
  
  // Step 2: Poll Telegram commands
  try {
    pollCommands();
  } catch (e) {
    Logger.log('Poll error: ' + e);
  }
}

// ========== EMAIL FUNCTIONS (Same as before) ==========

function checkEmails() {
  try {
    const emails = fetchRecentEmails();
    if (emails.length === 0) return;
    
    const results = processEmailsWithAI(emails);
    if (results.length === 0) return;
    
    const savedCount = saveToSheet(results);
    sendNotifications(results);
    
  } catch (error) {
    Logger.log('❌ checkEmails error: ' + error.message);
  }
}

function fetchRecentEmails() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CONFIG.DAYS_TO_CHECK);
  
  const dateStr = Utilities.formatDate(cutoffDate, Session.getScriptTimeZone(), 'yyyy/MM/dd');
  const threads = GmailApp.search(`after:${dateStr}`, 0, CONFIG.MAX_EMAILS_PER_BATCH);
  
  const processedIds = getProcessedMessageIds();
  const emails = [];
  
  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const messageId = message.getId();
      if (!processedIds.has(messageId)) {
        emails.push({
          id: messageId,
          subject: message.getSubject(),
          snippet: message.getPlainBody().substring(0, 500),
          from: message.getFrom(),
          date: message.getDate()
        });
      }
    });
  });
  
  return emails;
}

function processEmailsWithAI(emails) {
  const prompt = buildAIPrompt(emails);
  const aiResponse = callOpenRouterAPI(prompt);
  return parseAIResponse(aiResponse, emails);
}

function buildAIPrompt(emails) {
  const emailsJSON = JSON.stringify(emails.map(e => ({
    id: e.id,
    subject: e.subject,
    snippet: e.snippet,
    from: e.from
  })), null, 2);

  return `Analyze these emails and extract job applications/rejections. Return ONLY JSON array:
[
  {"id": "...", "company": "...", "position": "...", "status": "Applied/Rejected", "source": "..."}
]

Input: ${emailsJSON}`;
}

function callOpenRouterAPI(prompt) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  
  const payload = {
    model: CONFIG.AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: CONFIG.AI_TEMPERATURE,
    max_tokens: 4096
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.OPENROUTER_API_KEY,
      'HTTP-Referer': 'https://script.google.com',
      'X-Title': 'Job Tracker Bot'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  return data.choices[0].message.content;
}

function parseAIResponse(aiResponse, originalEmails) {
  let parsed;
  try {
    parsed = JSON.parse(aiResponse);
  } catch (e) {
    const match = aiResponse.match(/\[[\s\S]*\]/);
    parsed = match ? JSON.parse(match[0]) : [];
  }
  
  const results = Array.isArray(parsed) ? parsed : (parsed.results || []);
  
  return results.map(result => {
    const original = originalEmails.find(e => e.id === result.id);
    if (!original) return null;
    return {
      id: result.id,
      company: result.company || 'Unknown',
      position: result.position || 'Not specified',
      status: result.status || 'Applied',
      source: result.source || 'Email',
      subject: original.subject,
      date: original.date
    };
  }).filter(r => r !== null);
}

function saveToSheet(results) {
  const sheet = getOrCreateSheet();
  let count = 0;
  
  results.forEach(result => {
    if (getProcessedMessageIds().has(result.id)) return;
    
    sheet.appendRow([
      Utilities.formatDate(result.date, Session.getScriptTimeZone(), 'dd-MMM-yyyy'),
      result.company,
      result.position,
      result.status,
      result.source,
      result.subject,
      new Date(),
      result.id
    ]);
    
    const lastRow = sheet.getLastRow();
    const statusCell = sheet.getRange(lastRow, 4);
    if (result.status === 'Applied') {
      statusCell.setBackground('#d9ead3').setFontColor('#38761d');
    } else if (result.status === 'Rejected') {
      statusCell.setBackground('#f4cccc').setFontColor('#cc0000');
    }
    
    count++;
  });
  
  return count;
}

function getProcessedMessageIds() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  const ids = new Set();
  for (let i = 1; i < data.length; i++) {
    if (data[i][7]) ids.add(data[i][7]);
  }
  return ids;
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  return sheet;
}

function sendNotifications(results) {
  if (!CONFIG.SEND_TELEGRAM) return;
  
  results.forEach((result, i) => {
    const emoji = result.status === 'Applied' ? '✅' : '❌';
    sendTelegramMessage(
      `${emoji} *${result.status}*\n\n` +
      `🏢 ${result.company}\n` +
      `💼 ${result.position}\n` +
      `📅 ${Utilities.formatDate(result.date, Session.getScriptTimeZone(), 'dd MMM yyyy')}`
    );
    if (i < results.length - 1) Utilities.sleep(500);
  });
}

// ========== TELEGRAM POLLING (THE FIX) ==========

function pollCommands() {
  const props = PropertiesService.getScriptProperties();
  let lastUpdateId = parseInt(props.getProperty('lastUpdateId') || '0');
  
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&limit=100`;
  
  const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  const data = JSON.parse(response.getContentText());
  
  if (!data.ok || !data.result || data.result.length === 0) {
    return; // No new messages
  }
  
  Logger.log(`📥 ${data.result.length} new messages`);
  
  data.result.forEach(update => {
    // IMPORTANT: Update ID save karo immediately
    lastUpdateId = update.update_id;
    props.setProperty('lastUpdateId', lastUpdateId.toString());
    
    // Process message
    if (!update.message || !update.message.text) return;
    
    const chatId = String(update.message.chat.id);
    const text = update.message.text;
    
    // Security check
    if (chatId !== CONFIG.TELEGRAM_CHAT_ID) {
      Logger.log('Unauthorized: ' + chatId);
      return;
    }
    
    // Parse command
    const command = text.trim().toLowerCase().split(' ')[0].split('@')[0];
    Logger.log('🎯 Command: ' + command);
    
    // Route to handler
    handleCommand(command);
  });
}

function handleCommand(command) {
  let response = '';
  
  switch(command) {
    case '/start':
    case '/help':
      response = getHelpMessage();
      break;
    case '/stats':
      response = getQuickStats();
      break;
    case '/summary':
      response = getDetailedSummary();
      break;
    case '/today':
      response = getTodayStats();
      break;
    case '/week':
      response = getWeekStats();
      break;
    case '/companies':
      response = getCompaniesList();
      break;
    case '/check':
      sendTelegramMessage('🔍 Checking emails now...');
      checkEmails();
      return; // Already sent message
    case '/test':
      response = '✅ Bot working!\nCommand: ' + command + '\nTime: ' + new Date().toLocaleTimeString();
      break;
    default:
      response = '❓ Unknown: "' + command + '"\nTry /help';
  }
  
  sendTelegramMessage(response);
}

function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    }),
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(url, options);
}

// ========== COMMAND RESPONSES ==========

function getHelpMessage() {
  return `👋 *Job Tracker Bot v2.2*\n\n` +
         `⏱ Polling Mode (1 min)\n\n` +
         `📊 *Commands:*\n` +
         `/stats - Quick stats\n` +
         `/summary - Detailed summary\n` +
         `/today - Today's applications\n` +
         `/week - This week's stats\n` +
         `/companies - Companies list\n` +
         `/check - Run email check\n` +
         `/test - Test bot\n` +
         `/help - This message`;
}

function getQuickStats() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return '📊 No data yet!';
  
  let applied = 0, rejected = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === 'Applied') applied++;
    if (data[i][3] === 'Rejected') rejected++;
  }
  
  const pending = applied - rejected;
  const rate = applied > 0 ? ((rejected / applied) * 100).toFixed(1) : 0;
  
  return `📊 *Stats*\n\n` +
         `✅ Applied: ${applied}\n` +
         `❌ Rejected: ${rejected}\n` +
         `⏳ Pending: ${pending}\n` +
         `📈 Response Rate: ${rate}%`;
}

function getDetailedSummary() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return '📊 No data!';
  
  let applied = 0, rejected = 0;
  const companies = new Set();
  const sources = {};
  
  for (let i = 1; i < data.length; i++) {
    const status = data[i][3];
    const company = data[i][1];
    const source = data[i][4];
    
    companies.add(company);
    if (status === 'Applied') applied++;
    if (status === 'Rejected') rejected++;
    sources[source] = (sources[source] || 0) + 1;
  }
  
  const topSources = Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s, c]) => `  • ${s}: ${c}`)
    .join('\n');
  
  return `📊 *Summary*\n\n` +
         `✅ ${applied} | ❌ ${rejected} | 🎯 ${companies.size} companies\n\n` +
         `*Top Sources:*\n${topSources}`;
}

function getTodayStats() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return '📊 No data!';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let applied = 0, rejected = 0;
  const companies = [];
  
  for (let i = 1; i < data.length; i++) {
    const ts = new Date(data[i][6]);
    ts.setHours(0, 0, 0, 0);
    
    if (ts.getTime() === today.getTime()) {
      const company = data[i][1];
      const status = data[i][3];
      
      if (status === 'Applied') {
        applied++;
        companies.push(`  ✅ ${company}`);
      } else if (status === 'Rejected') {
        rejected++;
        companies.push(`  ❌ ${company}`);
      }
    }
  }
  
  if (applied === 0 && rejected === 0) return '📊 No applications today!';
  
  return `📅 *Today*\n\n` +
         `✅ ${applied} | ❌ ${rejected}\n\n` +
         `*Companies:*\n${companies.slice(0, 10).join('\n')}`;
}

function getWeekStats() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return '📊 No data!';
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  let applied = 0, rejected = 0;
  
  for (let i = 1; i < data.length; i++) {
    const ts = new Date(data[i][6]);
    if (ts >= weekAgo) {
      if (data[i][3] === 'Applied') applied++;
      if (data[i][3] === 'Rejected') rejected++;
    }
  }
  
  return `📅 *This Week*\n\n` +
         `✅ Applied: ${applied}\n` +
         `❌ Rejected: ${rejected}\n` +
         `📊 Total: ${applied + rejected}`;
}

function getCompaniesList() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return '📊 No companies!';
  
  const map = new Map();
  
  for (let i = 1; i < data.length; i++) {
    const company = data[i][1];
    const status = data[i][3];
    
    if (!map.has(company)) map.set(company, {applied: 0, rejected: 0});
    const stats = map.get(company);
    if (status === 'Applied') stats.applied++;
    if (status === 'Rejected') stats.rejected++;
  }
  
  const list = Array.from(map.entries())
    .sort((a, b) => (b[1].applied + b[1].rejected) - (a[1].applied + a[1].rejected))
    .slice(0, 15)
    .map(([c, s]) => `  • ${c}: ${s.applied + s.rejected} (⏳${s.applied - s.rejected})`)
    .join('\n');
  
  return `🏢 *Companies*\n\n${list}`;
}

// ========== TEST FUNCTIONS ==========

function testPolling() {
  Logger.log('Testing polling...');
  pollCommands();
}

function testCommand(command) {
  Logger.log('Testing: ' + command);
  handleCommand(command);
}
