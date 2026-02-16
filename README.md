🤖 AI Job Tracker — Gmail + AI + Telegram Automation

I kept seeing people share how many applications and rejections it took before landing a job — so instead of tracking mine manually, I built a simple AI automation to do it for me.

This project automatically reads job-related emails, detects applications or rejections using AI, logs everything into Google Sheets, and lets me check stats instantly through a Telegram bot.

No subscriptions.
No manual tracking.
Just pure automation.

<img width="537" height="267" alt="image" src="https://github.com/user-attachments/assets/06f66e55-cb9c-402b-a7e4-1fbd4afe8b7a" />
<img width="546" height="183" alt="image" src="https://github.com/user-attachments/assets/aa8cf0a2-824f-428a-bf0d-3d9fa6a4598d" />

✨ Features

📧 Reads incoming Gmail emails automatically

🧠 AI detects Applied / Rejected status

📊 Logs structured data into Google Sheets

🤖 Telegram bot for quick stats & commands

⚡ Runs fully on Google Apps Script (no server needed)

🧩 How It Works
1️⃣ Gmail Scan

The script scans new emails using a search query and extracts:

Subject

Sender

Snippet

Message ID

2️⃣ AI Processing

Emails are sent to an AI model via OpenRouter.

The AI returns structured JSON containing:

Company Name

Role

Status (Applied / Rejected)

Source

3️⃣ Auto Logging

Data is automatically saved into Google Sheets:

Date | Company | Position | Status | Source | Email ID

4️⃣ Telegram Bot

You can send commands like:

/stats
/summary
/today
/week
/companies


The bot pulls live data from Sheets and shows your progress instantly.

🛠️ Tech Stack

Google Apps Script

Gmail API

Google Sheets

Telegram Bot API

OpenRouter AI

JavaScript

⚙️ Setup Guide
1️⃣ Create Telegram Bot

Open Telegram → @BotFather

Create new bot

Copy bot token

2️⃣ Get OpenRouter API Key

https://openrouter.ai

Generate API key

3️⃣ Add CONFIG

Inside the script:

TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
OPENROUTER_API_KEY
SHEET_NAME

4️⃣ Add Trigger (Polling Mode)

Apps Script → Triggers:

Function: checkEmailsAndProcessAI
Type: Time-driven
Every 1 minute

▶️ Usage

Apply to jobs

Receive emails

Script processes automatically

Use Telegram bot to check stats

Example:

/stats

🎬 Demo

Watch the LinkedIn demo video to see the full workflow in action.

🚀 Future Improvements

Real-time webhook mode

AI summaries

Pipeline analytics

Visual dashboard

🙌 Author

Built by Aryan Chaudhary
GitHub: https://github.com/thegurjararyan

If this helped you, consider giving the repo a ⭐
