// app/landingPage/page.js

'use client'

import { useState } from 'react'
import { Dialog, DialogPanel } from '@headlessui/react'
import {
  ArrowPathIcon,
  Bars3Icon,
  CloudArrowUpIcon,
  FingerPrintIcon,
  LockClosedIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/20/solid'
import React from 'react'
import XverseLogin from '../../components/wallet/XverseLogin'

const navigation = [
  { name: 'Product', href: '#' },
  { name: 'Features', href: '#' },
  { name: 'Research', href: '#' },
  { name: 'Pricing', href: '#' },
]

const features = [
  {
    name: 'Real-Time Transaction Monitoring',
    description:
      'Monitor blockchain transactions in real-time, providing insights into transaction volumes, fees, and mempool status.',
    icon: CloudArrowUpIcon,
  },
  {
    name: 'Smart Wallet Tracking',
    description:
      'Monitor smart wallet activities, including transaction history, asset balances, and movement patterns. Get insights into wallet behaviors and track changes in holdings over time.',
    icon: WalletIcon,
  },
  {
    name: 'On-Chain Data Visualization',
    description:
      'Visualize blockchain data with customizable charts and graphs, offering deep insights into blockchain activity and trends.',
    icon: ArrowPathIcon,
  },
  {
    name: 'Blockchain Health Metrics',
    description:
      'Access advanced metrics to assess the health and performance of blockchain networks, including node uptime and block propagation.',
    icon: FingerPrintIcon,
  },
]

const tiers = [
  {
    name: 'Freelancer',
    id: 'tier-freelancer',
    href: '#',
    priceMonthly: '$24',
    description: 'The essentials to provide your best work for clients.',
    features: ['5 products', 'Up to 1,000 subscribers', 'Basic analytics', '48-hour support response time'],
    mostPopular: false,
  },
  {
    name: 'Startup',
    id: 'tier-startup',
    href: '#',
    priceMonthly: '$32',
    description: 'A plan that scales with your rapidly growing business.',
    features: [
      '25 products',
      'Up to 10,000 subscribers',
      'Advanced analytics',
      '24-hour support response time',
      'Marketing automations',
    ],
    mostPopular: true,
  },
  {
    name: 'Enterprise',
    id: 'tier-enterprise',
    href: '#',
    priceMonthly: '$48',
    description: 'Dedicated support and infrastructure for your company.',
    features: [
      'Unlimited products',
      'Unlimited subscribers',
      'Advanced analytics',
      '1-hour, dedicated support response time',
      'Marketing automations',
    ],
    mostPopular: false,
  },
]

const faqs = [
  {
    id: 1,
    question: 'What is blockchain analytics?',
    answer:
      'Blockchain analytics involves analyzing blockchain data to gain insights into transactions, smart contracts, and network health. Our tools provide real-time data to help investors make informed decisions.',
  },
  {
    id: 2,
    question: 'How does real-time transaction monitoring work?',
    answer:
      'Our platform tracks blockchain transactions as they happen, offering detailed information on transaction volumes, fees, and network status, allowing you to stay ahead in the market.',
  },
  {
    id: 3,
    question: 'What can I learn from smart contract analysis?',
    answer:
      'Smart contract analysis helps identify vulnerabilities, efficiency issues, and performance metrics. Our tools provide comprehensive reports to ensure you understand the contracts you’re investing in.',
  },
  {
    id: 4,
    question: 'How can on-chain data visualization benefit me?',
    answer:
      'On-chain data visualization allows you to see patterns and trends in blockchain activity through charts and graphs, helping you to make data-driven investment decisions.',
  },
  {
    id: 5,
    question: 'What is the benefit of using your API?',
    answer:
      'Our API offers direct access to a vast array of on-chain analytics, allowing you to integrate advanced blockchain data into your own systems for more customized and in-depth analysis.',
  },
]

const footerNavigation = {
  solutions: [
    { name: 'Hosting', href: '#' },
    { name: 'Data Services', href: '#' },
    { name: 'Uptime Monitoring', href: '#' },
    { name: 'Enterprise Services', href: '#' },
  ],
  support: [
    { name: 'Pricing', href: '#' },
    { name: 'Documentation', href: '#' },
    { name: 'Guides', href: '#' },
    { name: 'API Reference', href: '#' },
  ],
  company: [
    { name: 'About', href: '#' },
    { name: 'Blog', href: '#' },
    { name: 'Jobs', href: '#' },
    { name: 'Press', href: '#' },
    { name: 'Partners', href: '#' },
  ],
  legal: [
    { name: 'Claim', href: '#' },
    { name: 'Privacy', href: '#' },
    { name: 'Terms', href: '#' },
  ],
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Example() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="bg-gray-900">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-50">
        <nav aria-label="Global" className="flex items-center justify-between p-6 lg:px-8">
          <div className="flex lg:flex-1">
            <a href="#" className="-m-1.5 p-1.5 flex items-center">
              <span className="sr-only">Prism</span>
              {/* Updated SVG logo with neon gradient */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="50" height="50">
                <defs>
                  <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#00FFA3', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#DC1FFF', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <polygon points="150,25 179,75 221,75 191,125 221,175 179,175 150,225 121,175 79,175 109,125 79,75 121,75" fill="url(#neonGradient)" />
              </svg>
              <span className="ml-3 text-xl font-bold text-white">Odinpool</span>
            </a>
          </div>
          <div className="flex lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-300"
            >
              <span className="sr-only">Open main menu</span>
              <Bars3Icon aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
          <div className="hidden lg:flex lg:gap-x-12">
            {navigation.map((item) => (
              <a key={item.name} href={item.href} className="text-sm font-semibold leading-6 text-gray-300 hover:text-white">
                {item.name}
              </a>
            ))}
          </div>
          <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            <XverseLogin />
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      <Dialog as="div" open={mobileMenuOpen} onClose={setMobileMenuOpen}>
        <Dialog.Panel className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 px-6 py-6 lg:hidden">
          <div className="flex items-center justify-between">
            <a href="#" className="-m-1.5 p-1.5 flex items-center">
              <span className="sr-only">Odinpool</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="40" height="40">
                {/* Same neon gradient logo */}
                <defs>
                  <linearGradient id="neonGradientMobile" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#00FFA3', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#DC1FFF', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <polygon points="150,25 179,75 221,75 191,125 221,175 179,175 150,225 121,175 79,175 109,125 79,75 121,75" fill="url(#neonGradientMobile)" />
              </svg>
              <span className="ml-3 text-xl font-bold text-white">Odinpool</span>
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="-m-2.5 rounded-md p-2.5 text-gray-300"
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-gray-700">
              <div className="space-y-2 py-6">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-300 hover:bg-gray-800 hover:text-white"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
              <div className="py-6">
                <XverseLogin />
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </Dialog>

      <main className="isolate">
        {/* Hero section */}
        <div className="relative pt-14">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 transform-gpu overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 opacity-80"
            />
            <div
              style={{
                backgroundImage: 'url(/Images/crypto-background.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              className="absolute inset-0 opacity-20"
            />
          </div>
          <div className="py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-4xl text-center">
                <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
                  Empower Your Crypto Investments with On-Chain Insights
                </h1>
                <p className="mt-6 text-xl leading-8 text-gray-300">
                  Odinpool provides cutting-edge blockchain analytics and data visualization tools, enabling traders to make data-driven decisions in the dynamic world of crypto finance.
                </p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                  <a
                    href="/analytics"
                    className="rounded-md bg-gradient-to-r from-purple-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-md hover:from-purple-600 hover:to-indigo-600 transition-all duration-200"
                  >
                    Get Started
                  </a>
                  <a href="#" className="text-sm font-semibold leading-6 text-gray-300 hover:text-white">
                    Learn More <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
              <div className="mt-20 flow-root sm:mt-32">
                <div className="-m-2 rounded-xl bg-gray-800 p-2 ring-1 ring-gray-700 lg:-m-4 lg:rounded-2xl lg:p-4">
                  <img
                    alt="App screenshot"
                    src="/Images/page.png"
                    width={2432}
                    height={1442}
                    className="rounded-md shadow-2xl ring-1 ring-gray-900/10"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-24 sm:py-32 bg-gray-900">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Features</h2>
              <p className="mt-4 text-lg leading-8 text-gray-300">
                Unlock the full potential of blockchain data with our comprehensive suite of tools.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div key={feature.name} className="text-center">
                  <feature.icon className="mx-auto h-12 w-12 text-indigo-500" aria-hidden="true" />
                  <h3 className="mt-6 text-lg font-semibold text-white">{feature.name}</h3>
                  <p className="mt-2 text-base text-gray-300">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
