import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config()

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors())
app.use(express.json())

const dashboard = {
  summary: {
    income: 14500,
    expenses: 9100,
    savings: 5400,
    owedToMe: 480,
    iOwe: 210,
    rentDue: 1000,
    outstanding: 920,
  },
  categoryBreakdown: [
    { name: 'Rent', value: 1000 },
    { name: 'Groceries', value: 800 },
    { name: 'Fuel', value: 220 },
    { name: 'Shopping', value: 320 },
    { name: 'Dining Out', value: 280 },
    { name: 'Utilities', value: 190 },
    { name: 'Health', value: 120 },
    { name: 'Other', value: 185 },
  ],
  insights: [
    'You spent 18% more on groceries than last month.',
    'Dining out spending increased by $62 this fortnight.',
    'Fuel costs decreased by 10% compared to last month.',
  ],
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'MoneyHub API' })
})

app.get('/api/dashboard', (_req, res) => {
  res.json(dashboard)
})

app.get('/api/transactions', (_req, res) => {
  res.json([
    {
      id: 1,
      date: '2026-10-23',
      store: "Pak'nSave",
      amount: 180,
      type: 'Expense',
      category: 'Groceries',
      notes: 'Weekly shop',
      personalOrShared: 'Personal',
    },
    {
      id: 2,
      date: '2026-10-22',
      store: 'BP',
      amount: 90,
      type: 'Expense',
      category: 'Fuel',
      notes: 'Travel',
      personalOrShared: 'Personal',
    },
  ])
})

app.get('/api/shared-expenses', (_req, res) => {
  res.json([
    {
      id: 1,
      title: 'Groceries',
      amount: 240,
      date: '2026-10-12',
      paidBy: 'Gurpreet',
      participants: 5,
      splitAmount: 48,
      status: 'Outstanding',
    },
  ])
})

app.get('/api/rent', (_req, res) => {
  res.json({
    currentWeek: 'Week 27',
    paidDue: '2 / 2',
    totalRentPaid: 1000,
    totalRentOutstanding: 250,
    history: [
      { week: 'Week 1', status: 'Paid', amount: 250 },
      { week: 'Week 2', status: 'Paid', amount: 250 },
      { week: 'Week 3', status: 'Due', amount: 250 },
      { week: 'Week 4', status: 'Upcoming', amount: 250 },
    ],
  })
})

app.get('/api/debts', (_req, res) => {
  res.json([
    { person: 'Aisha', amount: 140, reason: 'Movie night', status: 'Pending', type: 'Owed To Me' },
    { person: 'Ben', amount: 90, reason: 'Groceries', status: 'Partial', type: 'I Owe' },
  ])
})

app.get('/api/settings', (_req, res) => {
  res.json({
    currency: 'NZD',
    weekStart: 'Sunday',
    weeklyRent: 250,
    monthlySavingsGoal: 2500,
  })
})

app.listen(port, () => {
  console.log(`MoneyHub API listening on http://localhost:${port}`)
})
