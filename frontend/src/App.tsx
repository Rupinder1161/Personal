import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  Moon,
  SunMedium,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'

const currencyFormatter = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0,
})

type Period = 'Weekly' | 'Fortnightly' | 'Monthly' | 'Yearly'

type Summary = {
  income: number
  expenses: number
  savings: number
  owedToMe: number
  iOwe: number
  rentDue: number
  outstanding: number
}

const getDateValue = (dateString: string) => {
  const parsed = new Date(`${dateString}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getPeriodStart = (period: Period) => {
  const now = new Date()
  const start = new Date(now)

  if (period === 'Weekly') {
    start.setDate(start.getDate() - 7)
  } else if (period === 'Fortnightly') {
    start.setDate(start.getDate() - 14)
  } else if (period === 'Monthly') {
    start.setMonth(start.getMonth() - 1)
  } else {
    start.setFullYear(start.getFullYear() - 1)
  }

  return new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0)
}

const getTransactionsInPeriod = (transactions: Transaction[], period: Period) => {
  const start = getPeriodStart(period)
  const end = new Date()

  return transactions.filter((transaction) => {
    const date = getDateValue(transaction.date)
    if (!date) {
      return false
    }
    return date >= start && date <= end
  })
}

const getCategoryColors: Record<string, string> = {
  Groceries: '#8b5cf6',
  Fuel: '#f59e0b',
  Shopping: '#10b981',
  Rent: '#6366f1',
  'Dining Out': '#f97316',
  Entertainment: '#ec4899',
  Utilities: '#14b8a6',
  Health: '#ef4444',
  Internet: '#38bdf8',
  Phone: '#a78bfa',
  Transport: '#facc15',
  Other: '#64748b',
}

const getCategorySpend = (transactions: Transaction[]) => {
  const grouped = new Map<string, number>()

  transactions
    .filter((transaction) => transaction.type === 'Expense')
    .forEach((transaction) => {
      grouped.set(transaction.category, (grouped.get(transaction.category) ?? 0) + transaction.amount)
    })

  return Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value, color: getCategoryColors[name] ?? '#64748b' }))
    .sort((a, b) => b.value - a.value)
}

const getMonthlyTrend = (transactions: Transaction[]) => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthMap = new Map<string, { income: number; expenses: number }>()

  const currentDate = new Date()
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - index, 1)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    monthMap.set(key, { income: 0, expenses: 0 })
  }

  transactions.forEach((transaction) => {
    const date = getDateValue(transaction.date)
    if (!date) {
      return
    }

    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (!monthMap.has(key)) {
      return
    }

    const bucket = monthMap.get(key)!
    if (transaction.type === 'Income') {
      bucket.income += transaction.amount
    } else {
      bucket.expenses += transaction.amount
    }
  })

  return Array.from(monthMap.entries()).map(([key, values]) => {
    const [year, monthIndex] = key.split('-').map((part) => Number(part))
    return {
      name: monthNames[monthIndex],
      income: values.income,
      expenses: values.expenses,
      year,
    }
  })
}

const getTopExpenses = (transactions: Transaction[]) => {
  const totals = new Map<string, number>()

  transactions
    .filter((transaction) => transaction.type === 'Expense')
    .forEach((transaction) => {
      totals.set(transaction.store, (totals.get(transaction.store) ?? 0) + transaction.amount)
    })

  return Array.from(totals.entries())
    .map(([vendor, amount]) => ({ vendor, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
}

const getCompareData = (transactions: Transaction[]) => {
  const categoryTotals = getCategorySpend(transactions)
  return categoryTotals.slice(0, 5).map((item) => ({
    name: item.name,
    change: Math.min(35, Math.max(-35, Math.round((item.value / 100) * 12))),
  }))
}

const getPeriodLabel = (period: Period) => {
  if (period === 'Weekly') return 'this week'
  if (period === 'Fortnightly') return 'this fortnight'
  if (period === 'Monthly') return 'this month'
  return 'this year'
}

const getInsights = (transactions: Transaction[], period: Period) => {
  const filtered = getTransactionsInPeriod(transactions, period)
  const expenses = filtered.filter((transaction) => transaction.type === 'Expense')
  const total = expenses.reduce((sum, item) => sum + item.amount, 0)
  const comparisonPeriod = period === 'Weekly' ? 'Weekly' : period === 'Fortnightly' ? 'Fortnightly' : period === 'Monthly' ? 'Monthly' : 'Yearly'

  const previousStart = getPeriodStart(period)
  const previousEnd = new Date()
  previousEnd.setDate(previousEnd.getDate() - 1)

  const previousRangeTransactions = transactions.filter((transaction) => {
    const date = getDateValue(transaction.date)
    if (!date) return false
    return date >= new Date(previousStart.getTime() - (previousEnd.getTime() - previousStart.getTime())) && date <= previousEnd
  })

  const previousExpenses = previousRangeTransactions.filter((transaction) => transaction.type === 'Expense')
  const previousTotal = previousExpenses.reduce((sum, item) => sum + item.amount, 0)
  const percentChange = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0

  if (expenses.length === 0) {
    return [`No spending recorded ${getPeriodLabel(period)} yet.`]
  }

  const topCategory = getCategorySpend(expenses).slice(0, 1)[0]
  const highestExpense = [...expenses].sort((a, b) => b.amount - a.amount)[0]

  return [
    `${total > 0 ? `You spent ${currencyFormatter.format(total)} ${getPeriodLabel(period)}.` : 'No spending recorded yet.'}`,
    previousTotal > 0
      ? `Compared with the previous ${comparisonPeriod.toLowerCase()} window, spending is ${Math.abs(percentChange).toFixed(0)}% ${percentChange <= 0 ? 'lower' : 'higher'}.`
      : 'No previous period data yet to compare against.',
    topCategory ? `${topCategory.name} is your largest category at ${currencyFormatter.format(topCategory.value)}.` : 'No major spending categories yet.',
    highestExpense ? `${highestExpense.store} was your largest individual expense at ${currencyFormatter.format(highestExpense.amount)}.` : 'No large individual purchases yet.',
  ]
}

const getSuggestions = (transactions: Transaction[]) => {
  const categories = getCategorySpend(transactions)
  if (categories.length === 0) {
    return []
  }

  return categories.slice(0, 2).map((item) => ({
    label: item.name,
    current: item.value,
    reduction: 15,
    saved: Math.round(item.value * 0.15),
  }))
}

type Transaction = {
  id: number
  date: string
  store: string
  amount: number
  type: 'Income' | 'Expense'
  category: string
  notes: string
  personalOrShared: 'Personal' | 'Shared'
}

const initialTransactions: Transaction[] = [
  { id: 1, date: '2026-10-23', store: 'Pak\'nSave', amount: 180, type: 'Expense', category: 'Groceries', notes: 'Weekly shop', personalOrShared: 'Personal' },
  { id: 2, date: '2026-10-22', store: 'BP', amount: 90, type: 'Expense', category: 'Fuel', notes: 'Travel', personalOrShared: 'Personal' },
  { id: 3, date: '2026-10-21', store: "McDonald's", amount: 25, type: 'Expense', category: 'Dining Out', notes: 'Lunch', personalOrShared: 'Shared' },
  { id: 4, date: '2026-10-20', store: 'Salary', amount: 4200, type: 'Income', category: 'Salary', notes: 'Monthly pay', personalOrShared: 'Personal' },
  { id: 5, date: '2026-10-18', store: 'Power', amount: 85, type: 'Expense', category: 'Utilities', notes: 'Electricity', personalOrShared: 'Personal' },
  { id: 6, date: '2026-10-17', store: 'Warehouse', amount: 120, type: 'Expense', category: 'Shopping', notes: 'Home items', personalOrShared: 'Shared' },
]

type SharedExpense = {
  id: number
  title: string
  amount: number
  date: string
  paidBy: string
  totalParticipants: number
  sharesPaidByMe: number
  sharesOwedToMe: number
  status: 'Outstanding' | 'Settled'
}

const initialSharedExpenseItems: SharedExpense[] = [
  { id: 1, title: 'Groceries', amount: 240, date: '2026-10-12', paidBy: 'Gurpreet', totalParticipants: 5, sharesPaidByMe: 2, sharesOwedToMe: 3, status: 'Outstanding' },
  { id: 2, title: 'Rent', amount: 700, date: '2026-10-08', paidBy: 'Me', totalParticipants: 2, sharesPaidByMe: 1, sharesOwedToMe: 1, status: 'Settled' },
  { id: 3, title: 'Dinner', amount: 86, date: '2026-10-05', paidBy: 'Wife', totalParticipants: 3, sharesPaidByMe: 1, sharesOwedToMe: 2, status: 'Outstanding' },
]

const calculateSplitAmount = (amount: number, totalParticipants: number) => amount / Math.max(totalParticipants, 1)

const calculateAmountOwedToMe = (items: SharedExpense[]) => items.reduce((sum, item) => sum + item.sharesOwedToMe * calculateSplitAmount(item.amount, item.totalParticipants), 0)

const calculateAmountYouNeedToPay = (items: SharedExpense[]) => items.reduce((sum, item) => {
  const split = calculateSplitAmount(item.amount, item.totalParticipants)
  const sharesYouPay = Math.max(item.totalParticipants - item.sharesPaidByMe - item.sharesOwedToMe, 0)
  return sum + sharesYouPay * split
}, 0)

type RentEntry = {
  id: number
  week: string
  amount: number
  status: 'Paid' | 'Due' | 'Upcoming' | 'Partial'
  paidDate: string
  notes: string
}

const initialRentEntries: RentEntry[] = [
  { id: 1, week: 'Week 1', amount: 250, status: 'Paid', paidDate: '2026-10-03', notes: 'Rent paid' },
  { id: 2, week: 'Week 2', amount: 250, status: 'Paid', paidDate: '2026-10-10', notes: 'Rent paid' },
  { id: 3, week: 'Week 3', amount: 250, status: 'Due', paidDate: '2026-10-17', notes: 'Due this week' },
  { id: 4, week: 'Week 4', amount: 250, status: 'Upcoming', paidDate: '2026-10-24', notes: 'Planned payment' },
]

type BillEntry = {
  id: number
  name: string
  amount: number
  date: string
  category: 'Electricity' | 'Water' | 'Gas' | 'Internet' | 'Other'
  notes: string
}

const initialBillEntries: BillEntry[] = [
  { id: 1, name: 'Electricity', amount: 120, date: '2026-10-12', category: 'Electricity', notes: 'Power bill' },
  { id: 2, name: 'Water', amount: 70, date: '2026-10-08', category: 'Water', notes: 'Council water' },
  { id: 3, name: 'Internet', amount: 95, date: '2026-10-05', category: 'Internet', notes: 'Home internet' },
]

const getWeekNumberFromDate = (dateString: string) => {
  if (!dateString) {
    return 1
  }

  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) {
    return 1
  }

  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000)
  const dayOfWeek = (startOfYear.getDay() + 6) % 7
  return Math.ceil((days + dayOfWeek + 1) / 7)
}

const getWeekLabelFromDate = (dateString: string) => `Week ${getWeekNumberFromDate(dateString)}`

const debtEntries = [
  { person: 'Aisha', amount: 140, reason: 'Movie night', date: '2026-10-02', status: 'Pending', type: 'Owed To Me' },
  { person: 'Ben', amount: 90, reason: 'Groceries', date: '2026-10-07', status: 'Partial', type: 'I Owe' },
  { person: 'Carl', amount: 40, reason: 'Fuel', date: '2026-10-09', status: 'Paid', type: 'Owed To Me' },
]

const getReportSnapshot = (transactions: Transaction[], days: number) => {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - days)

  const current = transactions.filter((transaction) => {
    const date = getDateValue(transaction.date)
    return date ? date >= start && date <= end : false
  })

  const income = current.filter((transaction) => transaction.type === 'Income').reduce((sum, item) => sum + item.amount, 0)
  const expenses = current.filter((transaction) => transaction.type === 'Expense').reduce((sum, item) => sum + item.amount, 0)
  const topCategory = getCategorySpend(current)[0]
  const topStore = getTopExpenses(current)[0]

  return {
    income,
    expenses,
    savings: income - expenses,
    topCategory: topCategory?.name ?? 'No data',
    topStore: topStore?.vendor ?? 'No data',
    transactionCount: current.length,
  }
}

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Transactions', to: '/transactions' },
  { label: 'Shared Expenses', to: '/shared-expenses' },
  { label: 'Rent Tracker', to: '/rent-tracker' },
  { label: 'Money Owed', to: '/money-owed' },
  { label: 'Reports', to: '/reports' },
  { label: 'Settings', to: '/settings' },
]

function App() {
  const [darkMode, setDarkMode] = useState(true)
  const [period, setPeriod] = useState<Period>('Monthly')
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const filteredTransactions = useMemo(() => getTransactionsInPeriod(transactions, period), [transactions, period])

  const summary = useMemo<Summary>(() => {
    const income = filteredTransactions.filter((transaction) => transaction.type === 'Income').reduce((sum, item) => sum + item.amount, 0)
    const expenses = filteredTransactions.filter((transaction) => transaction.type === 'Expense').reduce((sum, item) => sum + item.amount, 0)
    const owedToMe = calculateAmountOwedToMe(initialSharedExpenseItems)
    const iOwe = calculateAmountYouNeedToPay(initialSharedExpenseItems)

    return {
      income,
      expenses,
      savings: income - expenses,
      owedToMe,
      iOwe,
      rentDue: Math.max(0, filteredTransactions.filter((transaction) => transaction.category === 'Rent').reduce((sum, item) => sum + item.amount, 0)),
      outstanding: iOwe,
    }
  }, [filteredTransactions])

  const categorySpend = useMemo(() => getCategorySpend(filteredTransactions), [filteredTransactions])
  const monthlyTrend = useMemo(() => getMonthlyTrend(transactions), [transactions])
  const compareData = useMemo(() => getCompareData(filteredTransactions), [filteredTransactions])
  const topExpenses = useMemo(() => getTopExpenses(filteredTransactions), [filteredTransactions])
  const suggestions = useMemo(() => getSuggestions(filteredTransactions), [filteredTransactions])
  const insights = useMemo(() => getInsights(transactions, period), [transactions, period])
  const reports = useMemo(() => ({
    weekly: getReportSnapshot(transactions, 7),
    fortnightly: getReportSnapshot(transactions, 14),
    monthly: getReportSnapshot(transactions, 30),
  }), [transactions])
  const totalCategorySpend = categorySpend.reduce((sum, item) => sum + item.value, 0)

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <header className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">MoneyHub</p>
                  <h1 className="text-xl font-semibold">Know where your money goes.</h1>
                </div>
              </div>

              <nav className="flex flex-wrap gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-full px-3 py-2 text-sm transition ${isActive ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDarkMode((value) => !value)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  aria-label="Toggle theme"
                >
                  {darkMode ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </header>

          <main className="mt-6">
            <Routes>
              <Route path="/" element={<DashboardPage period={period} setPeriod={setPeriod} summary={summary} insights={insights} suggestions={suggestions} categorySpend={categorySpend} totalCategorySpend={totalCategorySpend} topExpenses={topExpenses} compareData={compareData} monthlyTrend={monthlyTrend} />} />
              <Route path="/transactions" element={<TransactionsPage transactions={transactions} setTransactions={setTransactions} />} />
              <Route path="/shared-expenses" element={<SharedExpensesPage />} />
              <Route path="/rent-tracker" element={<RentPage />} />
              <Route path="/money-owed" element={<MoneyOwedPage />} />
                          <Route path="/reports" element={<ReportsPage categorySpend={categorySpend} monthlyTrend={monthlyTrend} reports={reports} />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/analytics" element={<AnalyticsPage categorySpend={categorySpend} monthlyTrend={monthlyTrend} />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

function DashboardPage({
  period,
  setPeriod,
  summary,
  insights,
  suggestions,
  categorySpend,
  totalCategorySpend,
  topExpenses,
  compareData,
  monthlyTrend,
}: {
  period: Period
  setPeriod: (value: Period) => void
  summary: Summary
  insights: string[]
  suggestions: Array<{ label: string; current: number; reduction: number; saved: number }>
  categorySpend: Array<{ name: string; value: number; color: string }>
  totalCategorySpend: number
  topExpenses: Array<{ vendor: string; amount: number }>
  compareData: Array<{ name: string; change: number }>
  monthlyTrend: Array<{ name: string; income: number; expenses: number; year: number }>
}) {
  const periodTabs: Period[] = ['Weekly', 'Fortnightly', 'Monthly', 'Yearly']

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-indigo-500/20 dark:border-slate-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-indigo-100">Dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold">Where did my money go?</h2>
          </div>

          <div className="inline-flex rounded-full bg-white/10 p-1">
            {periodTabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${period === item ? 'bg-white text-indigo-700' : 'text-indigo-100 hover:text-white'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Current Month Income" value={currencyFormatter.format(summary.income)} tone="positive" />
        <MetricCard title="Current Month Expenses" value={currencyFormatter.format(summary.expenses)} tone="warning" />
        <MetricCard title="Current Month Savings" value={currencyFormatter.format(summary.savings)} tone="success" />
        <MetricCard title="Money Owed To Me" value={currencyFormatter.format(summary.owedToMe)} tone="neutral" />
        <MetricCard title="Money I Owe" value={currencyFormatter.format(summary.iOwe)} tone="danger" />
        <MetricCard title="Weekly Rent Due" value={currencyFormatter.format(summary.rentDue)} tone="neutral" />
        <MetricCard title="Shared Expenses Outstanding" value={currencyFormatter.format(summary.outstanding)} tone="warning" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Spending breakdown</p>
              <h3 className="text-xl font-semibold">Budget categories</h3>
            </div>
            <div className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
              {currencyFormatter.format(totalCategorySpend)} total
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categorySpend} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92} paddingAngle={4}>
                  {categorySpend.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => {
                    const numericValue = Array.isArray(value) ? value[0] : value
                    return currencyFormatter.format(Number(numericValue ?? 0))
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {categorySpend.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{item.name}</span>
                </div>
                <span className="text-sm font-medium">{currencyFormatter.format(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">Spending insights</p>
            <div className="mt-4 space-y-3">
              {insights.map((insight) => (
                <div key={insight} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {insight}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">Savings suggestions</p>
            <div className="mt-4 space-y-3">
              {suggestions.map((item) => (
                <div key={item.label} className="rounded-2xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
                  <p className="font-medium">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    ${item.current} this month · Reducing by {item.reduction}% could save ${item.saved} per month
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">Monthly spending trend</h3>
            <TrendingUp className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value) => {
                    const numericValue = Array.isArray(value) ? value[0] : value
                    return currencyFormatter.format(Number(numericValue ?? 0))
                  }}
                />
                <Area type="monotone" dataKey="income" stroke="#6366f1" fill="url(#incomeFill)" strokeWidth={3} />
                <Area type="monotone" dataKey="expenses" stroke="#f97316" fillOpacity={0} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">What changed</h3>
            <BarChart3 className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="space-y-3">
            {compareData.map((row) => (
              <div key={row.name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <span className="font-medium">{row.name}</span>
                <span className={`${row.change >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-semibold`}>
                  {row.change >= 0 ? '↑' : '↓'} {Math.abs(row.change)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Top 5 Expenses</h3>
          <button type="button" className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>

        <div className="space-y-2">
          {topExpenses.map((expense, index) => (
            <div key={expense.vendor} className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-3 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {index + 1}
                </span>
                <span className="font-medium">{expense.vendor}</span>
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{currencyFormatter.format(expense.amount)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TransactionsPage({
  transactions,
  setTransactions,
}: {
  transactions: Transaction[]
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<Transaction>({
    id: 0,
    date: '2026-10-23',
    store: 'Pak\'nSave',
    amount: 180,
    type: 'Expense',
    category: 'Groceries',
    notes: 'Weekly shop',
    personalOrShared: 'Personal',
  })

  const handleFieldChange = (field: keyof Transaction, value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: field === 'amount' ? Number(value) : value,
    }))
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      id: 0,
      date: '2026-10-23',
      store: 'Pak\'nSave',
      amount: 180,
      type: 'Expense',
      category: 'Groceries',
      notes: 'Weekly shop',
      personalOrShared: 'Personal',
    })
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextTransaction = {
      ...formData,
      amount: Number(formData.amount),
    }

    if (editingId !== null) {
      setTransactions((current) =>
        current.map((entry) => (entry.id === editingId ? { ...entry, ...nextTransaction, id: editingId } : entry)),
      )
    } else {
      setTransactions((current) => [{ ...nextTransaction, id: Date.now() }, ...current])
    }

    resetForm()
  }

  const handleEdit = (entry: Transaction) => {
    setEditingId(entry.id)
    setFormData(entry)
  }

  const handleDelete = (id: number) => {
    setTransactions((current) => current.filter((entry) => entry.id !== id))
    if (editingId === id) {
      resetForm()
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Add, edit, filter, and review every cash flow event." />

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <Field label="Date">
              <input
                value={formData.date}
                onChange={(event) => handleFieldChange('date', event.target.value)}
                type="date"
                className="input-field"
              />
            </Field>
            <Field label="Store / Vendor">
              <input
                value={formData.store}
                onChange={(event) => handleFieldChange('store', event.target.value)}
                className="input-field"
              />
            </Field>
            <Field label="Amount">
              <input
                value={formData.amount}
                onChange={(event) => handleFieldChange('amount', event.target.value)}
                type="number"
                className="input-field"
              />
            </Field>
            <Field label="Type">
              <select
                value={formData.type}
                onChange={(event) => handleFieldChange('type', event.target.value)}
                className="input-field"
              >
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </Field>
            <Field label="Category">
              <select
                value={formData.category}
                onChange={(event) => handleFieldChange('category', event.target.value)}
                className="input-field"
              >
                <option value="Rent">Rent</option>
                <option value="Groceries">Groceries</option>
                <option value="Fuel">Fuel</option>
                <option value="Dining Out">Dining Out</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Shopping">Shopping</option>
                <option value="Utilities">Utilities</option>
                <option value="Internet">Internet</option>
                <option value="Phone">Phone</option>
                <option value="Transport">Transport</option>
                <option value="Health">Health</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Notes">
              <input
                value={formData.notes}
                onChange={(event) => handleFieldChange('notes', event.target.value)}
                className="input-field"
              />
            </Field>
            <Field label="Personal / Shared">
              <select
                value={formData.personalOrShared}
                onChange={(event) => handleFieldChange('personalOrShared', event.target.value)}
                className="input-field"
              >
                <option value="Personal">Personal</option>
                <option value="Shared">Shared</option>
              </select>
            </Field>
          </div>
          <div className="flex items-center gap-2">
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
            )}
            <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white shadow hover:bg-indigo-500">
              {editingId !== null ? 'Update' : 'Add'}
            </button>
          </div>
        </form>

        <div className="mb-4 flex flex-wrap gap-2">
          {['Today', 'This Week', 'This Fortnight', 'This Month', 'Custom Range'].map((filter) => (
            <button key={filter} type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              {filter}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Store / Vendor</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Personal / Shared</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-3">{entry.date}</td>
                  <td className="px-3 py-3">{entry.store}</td>
                  <td className="px-3 py-3 font-semibold">{currencyFormatter.format(entry.amount)}</td>
                  <td className="px-3 py-3">{entry.type}</td>
                  <td className="px-3 py-3">{entry.category}</td>
                  <td className="px-3 py-3">{entry.personalOrShared}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEdit(entry)} className="text-indigo-600">Edit</button>
                      <button type="button" onClick={() => handleDelete(entry.id)} className="text-rose-600">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SharedExpensesPage() {
  const [sharedExpenseItems, setSharedExpenseItems] = useState<SharedExpense[]>(initialSharedExpenseItems)
  const [formData, setFormData] = useState({
    title: 'Groceries',
    amount: 240,
    date: '2026-10-12',
    paidBy: 'Gurpreet',
    totalParticipants: 5,
    sharesPaidByMe: 2,
    sharesOwedToMe: 3,
  })

  const totalExpenses = sharedExpenseItems.reduce((sum, item) => sum + item.amount, 0)
  const amountOwedToMe = sharedExpenseItems.reduce((sum, item) => {
    const split = item.amount / Math.max(item.totalParticipants, 1)
    return sum + item.sharesOwedToMe * split
  }, 0)
  const amountYouNeedToPay = sharedExpenseItems.reduce((sum, item) => {
    const split = item.amount / Math.max(item.totalParticipants, 1)
    const sharesYouPay = Math.max(item.totalParticipants - item.sharesPaidByMe - item.sharesOwedToMe, 0)
    return sum + sharesYouPay * split
  }, 0)
  const rentAndBills = 1250 + 420
  const netAfterRentBills = Math.max(0, rentAndBills - amountOwedToMe)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const newItem: SharedExpense = {
      id: Date.now(),
      title: formData.title || 'Shared expense',
      amount: Number(formData.amount) || 0,
      date: formData.date || new Date().toISOString().slice(0, 10),
      paidBy: formData.paidBy || 'Me',
      totalParticipants: Number(formData.totalParticipants) || 1,
      sharesPaidByMe: Number(formData.sharesPaidByMe) || 0,
      sharesOwedToMe: Number(formData.sharesOwedToMe) || 0,
      status: 'Outstanding',
    }

    setSharedExpenseItems((current) => [newItem, ...current])
    setFormData({
      title: 'Groceries',
      amount: 240,
      date: '2026-10-12',
      paidBy: 'Gurpreet',
      totalParticipants: 5,
      sharesPaidByMe: 2,
      sharesOwedToMe: 3,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Shared Expenses" description="Track costs evenly across family and friends." />

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-semibold">Create Shared Expense</h3>
          <div className="mt-4 space-y-3">
            <Field label="Title">
              <input
                value={formData.title}
                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                className="input-field"
              />
            </Field>
            <Field label="Amount">
              <input
                value={formData.amount}
                onChange={(event) => setFormData((current) => ({ ...current, amount: Number(event.target.value) }))}
                type="number"
                className="input-field"
              />
            </Field>
            <Field label="Date">
              <input
                value={formData.date}
                onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
                type="date"
                className="input-field"
              />
            </Field>
            <Field label="Paid By">
              <input
                value={formData.paidBy}
                onChange={(event) => setFormData((current) => ({ ...current, paidBy: event.target.value }))}
                className="input-field"
              />
            </Field>
            <Field label="Total participants">
              <input
                value={formData.totalParticipants}
                onChange={(event) => setFormData((current) => ({ ...current, totalParticipants: Number(event.target.value) || 1 }))}
                type="number"
                className="input-field"
              />
            </Field>
            <Field label="How many shares did you pay for?">
              <input
                value={formData.sharesPaidByMe}
                onChange={(event) => setFormData((current) => ({ ...current, sharesPaidByMe: Number(event.target.value) || 0 }))}
                type="number"
                className="input-field"
              />
            </Field>
            <Field label="How many shares should you get back?">
              <input
                value={formData.sharesOwedToMe}
                onChange={(event) => setFormData((current) => ({ ...current, sharesOwedToMe: Number(event.target.value) || 0 }))}
                type="number"
                className="input-field"
              />
            </Field>
            <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500">Save expense</button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatPill label="Total Shared Expenses" value={currencyFormatter.format(totalExpenses)} />
            <StatPill label="Outstanding Balances" value={currencyFormatter.format(amountYouNeedToPay)} />
            <StatPill label="Amount Owed To Me" value={currencyFormatter.format(amountOwedToMe)} />
            <StatPill label="Net After Rent & Bills" value={currencyFormatter.format(netAfterRentBills)} />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-semibold">Recent shared expenses</h3>
            <div className="mt-4 space-y-3">
              {sharedExpenseItems.map((item) => {
                const split = item.amount / Math.max(item.totalParticipants, 1)
                const youPaid = item.sharesPaidByMe * split
                const owedToYou = item.sharesOwedToMe * split
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{item.date} · Paid by {item.paidBy}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">{item.status}</span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex items-center justify-between"><span>Total</span><span>{currencyFormatter.format(item.amount)}</span></div>
                      <div className="flex items-center justify-between"><span>Per share</span><span>{currencyFormatter.format(split)}</span></div>
                      <div className="flex items-center justify-between"><span>You paid</span><span>{currencyFormatter.format(youPaid)}</span></div>
                      <div className="flex items-center justify-between"><span>They owe you</span><span>{currencyFormatter.format(owedToYou)}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RentPage() {
  const [rentEntries, setRentEntries] = useState<RentEntry[]>(initialRentEntries)
  const [billEntries, setBillEntries] = useState<BillEntry[]>(initialBillEntries)
  const [rentForm, setRentForm] = useState({
    week: getWeekLabelFromDate('2026-10-24'),
    amount: 250,
    status: 'Paid' as RentEntry['status'],
    paidDate: '2026-10-24',
    notes: 'Paid this week',
  })
  const [billForm, setBillForm] = useState({
    name: 'Electricity',
    amount: 120,
    date: '2026-10-24',
    category: 'Electricity' as BillEntry['category'],
    notes: 'This week utility bill',
  })
  const [editingRentId, setEditingRentId] = useState<number | null>(null)
  const [editingBillId, setEditingBillId] = useState<number | null>(null)

  const totalRentPaid = rentEntries.reduce((sum, entry) => sum + (entry.status === 'Paid' || entry.status === 'Partial' ? entry.amount : 0), 0)
  const totalBillsPaid = billEntries.reduce((sum, entry) => sum + entry.amount, 0)
  const amountOwedToMe = calculateAmountOwedToMe(initialSharedExpenseItems)
  const outstandingSharedPayments = calculateAmountYouNeedToPay(initialSharedExpenseItems)
  const netRentBillsAfterOwed = Math.max(0, totalRentPaid + totalBillsPaid - amountOwedToMe)
  const currentWeekLabel = getWeekLabelFromDate(new Date().toISOString().slice(0, 10))
  const outstandingRent = rentEntries.filter((entry) => entry.status === 'Due' || entry.status === 'Upcoming').reduce((sum, entry) => sum + entry.amount, 0)

  const resetRentForm = () => {
    setRentForm({
      week: getWeekLabelFromDate('2026-10-24'),
      amount: 250,
      status: 'Paid',
      paidDate: '2026-10-24',
      notes: 'Paid this week',
    })
    setEditingRentId(null)
  }

  const resetBillForm = () => {
    setBillForm({
      name: 'Electricity',
      amount: 120,
      date: '2026-10-24',
      category: 'Electricity',
      notes: 'This week utility bill',
    })
    setEditingBillId(null)
  }

  const handleRentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const entry: RentEntry = {
      id: editingRentId ?? Date.now(),
      week: getWeekLabelFromDate(rentForm.paidDate),
      amount: Number(rentForm.amount) || 0,
      status: rentForm.status,
      paidDate: rentForm.paidDate,
      notes: rentForm.notes,
    }

    setRentEntries((current) => {
      if (editingRentId !== null) {
        return current.map((item) => (item.id === editingRentId ? entry : item))
      }
      return [entry, ...current]
    })

    resetRentForm()
  }

  const handleBillSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const entry: BillEntry = {
      id: editingBillId ?? Date.now(),
      name: billForm.name || 'Electricity',
      amount: Number(billForm.amount) || 0,
      date: billForm.date,
      category: billForm.category,
      notes: billForm.notes,
    }

    setBillEntries((current) => {
      if (editingBillId !== null) {
        return current.map((item) => (item.id === editingBillId ? entry : item))
      }
      return [entry, ...current]
    })

    resetBillForm()
  }

  const handleEditRent = (entry: RentEntry) => {
    setRentForm({
      week: entry.week,
      amount: entry.amount,
      status: entry.status,
      paidDate: entry.paidDate,
      notes: entry.notes,
    })
    setEditingRentId(entry.id)
  }

  const handleEditBill = (entry: BillEntry) => {
    setBillForm({
      name: entry.name,
      amount: entry.amount,
      date: entry.date,
      category: entry.category,
      notes: entry.notes,
    })
    setEditingBillId(entry.id)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Rent Tracker" description="Track weekly rent, utility bills, and what is left after shared expenses recoveries." />

      <div className="grid gap-4 md:grid-cols-5">
        <StatPill label="Current Week" value={currentWeekLabel} />
        <StatPill label="Rent Paid" value={currencyFormatter.format(totalRentPaid)} />
        <StatPill label="Bills Paid" value={currencyFormatter.format(totalBillsPaid)} />
        <StatPill label="Owed To Me" value={currencyFormatter.format(amountOwedToMe)} />
        <StatPill label="Rent + Bills - Owed" value={currencyFormatter.format(netRentBillsAfterOwed)} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-3">
          <StatPill label="Outstanding rent" value={currencyFormatter.format(outstandingRent)} />
          <StatPill label="Shared payments due" value={currencyFormatter.format(outstandingSharedPayments)} />
          <StatPill label="Total due this cycle" value={currencyFormatter.format(Math.max(0, outstandingRent + totalBillsPaid + outstandingSharedPayments - amountOwedToMe))} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleRentSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">{editingRentId !== null ? 'Update weekly rent' : 'Add weekly rent'}</h3>
            {editingRentId !== null && (
              <button type="button" onClick={resetRentForm} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300">Cancel</button>
            )}
          </div>
          <div className="space-y-3">
            <Field label="Week"><input value={getWeekLabelFromDate(rentForm.paidDate)} readOnly className="input-field bg-slate-100 dark:bg-slate-800" /></Field>
            <Field label="Rent amount"><input value={rentForm.amount} onChange={(event) => setRentForm((current) => ({ ...current, amount: Number(event.target.value) || 0 }))} type="number" className="input-field" /></Field>
            <Field label="Status">
              <select value={rentForm.status} onChange={(event) => setRentForm((current) => ({ ...current, status: event.target.value as RentEntry['status'] }))} className="input-field">
                <option value="Paid">Paid</option>
                <option value="Due">Due</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Partial">Partial</option>
              </select>
            </Field>
            <Field label="Payment date"><input value={rentForm.paidDate} onChange={(event) => setRentForm((current) => ({ ...current, paidDate: event.target.value }))} type="date" className="input-field" /></Field>
            <Field label="Notes"><input value={rentForm.notes} onChange={(event) => setRentForm((current) => ({ ...current, notes: event.target.value }))} className="input-field" /></Field>
            <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500">
              {editingRentId !== null ? 'Save rent changes' : 'Save rent'}
            </button>
          </div>
        </form>

        <form onSubmit={handleBillSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">{editingBillId !== null ? 'Update bill' : 'Add bill'}</h3>
            {editingBillId !== null && (
              <button type="button" onClick={resetBillForm} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300">Cancel</button>
            )}
          </div>
          <div className="space-y-3">
            <Field label="Bill type"><input value={billForm.name} onChange={(event) => setBillForm((current) => ({ ...current, name: event.target.value }))} className="input-field" /></Field>
            <Field label="Category">
              <select value={billForm.category} onChange={(event) => setBillForm((current) => ({ ...current, category: event.target.value as BillEntry['category'] }))} className="input-field">
                <option value="Electricity">Electricity</option>
                <option value="Water">Water</option>
                <option value="Gas">Gas</option>
                <option value="Internet">Internet</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Amount"><input value={billForm.amount} onChange={(event) => setBillForm((current) => ({ ...current, amount: Number(event.target.value) || 0 }))} type="number" className="input-field" /></Field>
            <Field label="Payment date"><input value={billForm.date} onChange={(event) => setBillForm((current) => ({ ...current, date: event.target.value }))} type="date" className="input-field" /></Field>
            <Field label="Notes"><input value={billForm.notes} onChange={(event) => setBillForm((current) => ({ ...current, notes: event.target.value }))} className="input-field" /></Field>
            <button type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500">
              {editingBillId !== null ? 'Save bill changes' : 'Save bill'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">Weekly rent history</h3>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{rentEntries.length} entries</span>
          </div>
          <div className="space-y-3">
            {rentEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{entry.week}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{entry.paidDate} · {entry.notes}</p>
                  </div>
                  <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">{entry.status}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>{currencyFormatter.format(entry.amount)}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleEditRent(entry)} className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300">Edit</button>
                    <button type="button" onClick={() => setRentEntries((current) => current.filter((item) => item.id !== entry.id))} className="text-xs font-medium text-rose-600 hover:text-rose-500">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">Bills paid</h3>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{billEntries.length} bills</span>
          </div>
          <div className="space-y-3">
            {billEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{entry.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{entry.category} · {entry.date}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">{entry.category}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>{currencyFormatter.format(entry.amount)}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleEditBill(entry)} className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300">Edit</button>
                    <button type="button" onClick={() => setBillEntries((current) => current.filter((item) => item.id !== entry.id))} className="text-xs font-medium text-rose-600 hover:text-rose-500">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-xl font-semibold">Weekly net payment summary</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <StatPill label="Total rent paid" value={currencyFormatter.format(totalRentPaid)} />
          <StatPill label="Total bills paid" value={currencyFormatter.format(totalBillsPaid)} />
          <StatPill label="Net after shared expenses" value={currencyFormatter.format(netRentBillsAfterOwed)} />
        </div>
        <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          This week you need to pay: {currencyFormatter.format(Math.max(0, totalRentPaid + totalBillsPaid - amountOwedToMe))}. This includes rent and all bills, minus money others owe you from shared expenses.
        </div>
      </div>
    </div>
  )
}

function MoneyOwedPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Money Owed" description="Track what people owe you and what you owe to others." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-semibold">People who owe me</h3>
          <div className="mt-4 space-y-3">
            {debtEntries.filter((entry) => entry.type === 'Owed To Me').map((entry) => (
              <div key={entry.person} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{entry.person}</p>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">{entry.status}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>{entry.reason}</span>
                  <span>{currencyFormatter.format(entry.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-semibold">People I owe</h3>
          <div className="mt-4 space-y-3">
            {debtEntries.filter((entry) => entry.type === 'I Owe').map((entry) => (
              <div key={entry.person} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{entry.person}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">{entry.status}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>{entry.reason}</span>
                  <span>{currencyFormatter.format(entry.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportsPage({
  categorySpend,
  monthlyTrend,
  reports,
}: {
  categorySpend: Array<{ name: string; value: number; color: string }>
  monthlyTrend: Array<{ name: string; income: number; expenses: number; year: number }>
  reports: {
    weekly: { income: number; expenses: number; savings: number; topCategory: string; topStore: string; transactionCount: number }
    fortnightly: { income: number; expenses: number; savings: number; topCategory: string; topStore: string; transactionCount: number }
    monthly: { income: number; expenses: number; savings: number; topCategory: string; topStore: string; transactionCount: number }
  }
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Performance snapshots across different time horizons." />

      <div className="grid gap-4 md:grid-cols-3">
        <ReportCard title="Weekly Report" data={reports.weekly} />
        <ReportCard title="Fortnightly Report" data={reports.fortnightly} />
        <ReportCard title="Monthly Report" data={reports.monthly} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Export</h3>
          <div className="flex gap-2">
            <button className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">CSV</button>
            <button className="rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white">Excel (.xlsx)</button>
          </div>
        </div>
      </div>

      <AnalyticsPage categorySpend={categorySpend} monthlyTrend={monthlyTrend} />
    </div>
  )
}

function AnalyticsPage({
  categorySpend,
  monthlyTrend,
}: {
  categorySpend: Array<{ name: string; value: number; color: string }>
  monthlyTrend: Array<{ name: string; income: number; expenses: number; year: number }>
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-xl font-semibold">Analytics</h3>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-3 font-medium">Spending by Category</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categorySpend} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                    {categorySpend.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currencyFormatter.format(Number(Array.isArray(value) ? value[0] : value ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-3 font-medium">Monthly Spending Trend</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => currencyFormatter.format(Number(Array.isArray(value) ? value[0] : value ?? 0))} />
                  <Area type="monotone" dataKey="income" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="expenses" stroke="#f97316" fill="#f97316" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-xl font-semibold">Financial health score</h3>
        <div className="flex items-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-indigo-500 to-violet-500 text-2xl font-bold text-white">84</div>
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">Based on savings rate, budget adherence, debt levels, spending growth, and rent payments.</p>
            <p className="text-lg font-medium">Strong savings discipline and manageable debt exposure.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Personalize the app to match your financial rhythm." />

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Currency"><input defaultValue="NZD" className="input-field" /></Field>
          <Field label="Week Start Day"><input defaultValue="Sunday" className="input-field" /></Field>
          <Field label="Weekly Rent"><input defaultValue="250" type="number" className="input-field" /></Field>
          <Field label="Monthly Savings Goal"><input defaultValue="2500" type="number" className="input-field" /></Field>
        </div>
      </div>
    </div>
  )
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">MoneyHub</p>
      <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{description}</p>
    </section>
  )
}

function MetricCard({ title, value, tone }: { title: string; value: string; tone: 'positive' | 'warning' | 'success' | 'neutral' | 'danger' }) {
  const scheme = {
    positive: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    danger: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${scheme[tone]}`}>
        {tone === 'positive' ? <ArrowUpRight className="h-3.5 w-3.5" /> : tone === 'danger' ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
        {title}
      </div>
      <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  )
}

function ReportCard({ title, data }: { title: string; data: Record<string, number | string> }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-xl font-semibold">{title}</h3>
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-b-0 dark:border-slate-700">
            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
            <span className="font-medium text-slate-900 dark:text-white">{typeof value === 'number' ? currencyFormatter.format(value) : value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
