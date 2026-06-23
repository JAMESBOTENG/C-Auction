import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";

interface YearData {
  year: number;
  revenue: number;
  cogs: number;
  operatingExpenses: Record<string, number>;
  ownerSalary: number;
  addBacks: { label: string; amount: number; category: string; note?: string }[];
}

interface ListingSeed {
  title: string;
  industry: string;
  state: string;
  yearFounded: number;
  employees: number;
  reasonForSale: string;
  askingPrice: number;
  imageUrl?: string;
  years: YearData[];
}

const listings: ListingSeed[] = [
  {
    title: "Established Residential HVAC Contractor",
    industry: "Residential HVAC",
    state: "TX",
    imageUrl: "https://d8j0ntlcm91z4.cloudfront.net/user_3F2LiUiOM9g7M1923tO7lOsFeNl/hf_20260622_143523_57430ab8-9b5f-457d-8663-fd9a813b1992.png",
    yearFounded: 1998,
    employees: 14,
    reasonForSale: "Owner retiring after 25+ years; no family successor.",
    askingPrice: 1_950_000,
    years: [
      {
        year: 2021,
        revenue: 2_800_000,
        cogs: 1_540_000,
        operatingExpenses: { payroll: 520_000, rent: 96_000, fleet: 84_000, marketing: 60_000, admin: 70_000 },
        ownerSalary: 180_000,
        addBacks: [
          { label: "Owner truck & fuel", amount: 14_000, category: "PERSONAL_EXPENSE" },
          { label: "Depreciation", amount: 62_000, category: "DEPRECIATION" },
          { label: "Interest on equipment loans", amount: 18_000, category: "INTEREST" },
        ],
      },
      {
        year: 2022,
        revenue: 3_150_000,
        cogs: 1_700_000,
        operatingExpenses: { payroll: 560_000, rent: 99_000, fleet: 90_000, marketing: 72_000, admin: 74_000 },
        ownerSalary: 190_000,
        addBacks: [
          { label: "Owner health insurance", amount: 22_000, category: "OWNER_COMP" },
          { label: "Owner truck & fuel", amount: 15_000, category: "PERSONAL_EXPENSE" },
          { label: "Depreciation", amount: 66_000, category: "DEPRECIATION" },
          { label: "Interest on equipment loans", amount: 16_000, category: "INTEREST" },
        ],
      },
      {
        year: 2023,
        revenue: 3_420_000,
        cogs: 1_820_000,
        operatingExpenses: { payroll: 610_000, rent: 102_000, fleet: 95_000, marketing: 80_000, admin: 78_000 },
        ownerSalary: 195_000,
        addBacks: [
          { label: "Owner health insurance", amount: 24_000, category: "OWNER_COMP" },
          { label: "Owner truck & fuel", amount: 16_000, category: "PERSONAL_EXPENSE" },
          { label: "One-time office buildout", amount: 38_000, category: "ONE_TIME" },
          { label: "Depreciation", amount: 70_000, category: "DEPRECIATION" },
          { label: "Interest on equipment loans", amount: 14_000, category: "INTEREST" },
        ],
      },
    ],
  },
  {
    title: "Medicare-Certified Home-Health Agency",
    industry: "Home-Health Agency",
    state: "FL",
    imageUrl: "https://d8j0ntlcm91z4.cloudfront.net/user_3F2LiUiOM9g7M1923tO7lOsFeNl/hf_20260622_143524_f584e1ff-151b-4886-9d8a-4e697f92cf2f.png",
    yearFounded: 2006,
    employees: 42,
    reasonForSale: "Founder relocating to care for family; seeking operator buyer.",
    askingPrice: 3_400_000,
    years: [
      {
        year: 2021,
        revenue: 4_200_000,
        cogs: 2_520_000,
        operatingExpenses: { admin: 380_000, rent: 120_000, software: 90_000, compliance: 110_000 },
        ownerSalary: 220_000,
        addBacks: [
          { label: "Owner auto allowance", amount: 18_000, category: "PERSONAL_EXPENSE" },
          { label: "Amortization of intangibles", amount: 40_000, category: "AMORTIZATION" },
          { label: "Interest", amount: 22_000, category: "INTEREST" },
        ],
      },
      {
        year: 2022,
        revenue: 4_650_000,
        cogs: 2_760_000,
        operatingExpenses: { admin: 400_000, rent: 124_000, software: 96_000, compliance: 118_000 },
        ownerSalary: 230_000,
        addBacks: [
          { label: "Owner auto allowance", amount: 18_000, category: "PERSONAL_EXPENSE" },
          { label: "Family member above-market salary", amount: 45_000, category: "OWNER_COMP" },
          { label: "Amortization of intangibles", amount: 40_000, category: "AMORTIZATION" },
          { label: "Interest", amount: 20_000, category: "INTEREST" },
        ],
      },
      {
        year: 2023,
        revenue: 5_100_000,
        cogs: 3_010_000,
        operatingExpenses: { admin: 430_000, rent: 128_000, software: 102_000, compliance: 124_000 },
        ownerSalary: 240_000,
        addBacks: [
          { label: "Owner auto allowance", amount: 19_000, category: "PERSONAL_EXPENSE" },
          { label: "Family member above-market salary", amount: 48_000, category: "OWNER_COMP" },
          { label: "One-time EHR migration", amount: 65_000, category: "ONE_TIME" },
          { label: "Amortization of intangibles", amount: 40_000, category: "AMORTIZATION" },
          { label: "Interest", amount: 18_000, category: "INTEREST" },
        ],
      },
    ],
  },
  {
    title: "Commercial Fire & Safety Systems Company",
    industry: "Commercial Fire & Safety",
    state: "OH",
    imageUrl: "https://loremflickr.com/1200/800/firefighter,fire,truck?lock=31",
    yearFounded: 1991,
    employees: 23,
    reasonForSale: "Owner retiring; recurring inspection contracts in place.",
    askingPrice: 2_600_000,
    years: [
      {
        year: 2021,
        revenue: 3_600_000,
        cogs: 1_980_000,
        operatingExpenses: { payroll: 640_000, rent: 110_000, fleet: 96_000, admin: 84_000 },
        ownerSalary: 200_000,
        addBacks: [
          { label: "Owner country club dues", amount: 16_000, category: "PERSONAL_EXPENSE" },
          { label: "Depreciation", amount: 58_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 21_000, category: "INTEREST" },
          { label: "Income taxes", amount: 30_000, category: "TAX" },
        ],
      },
      {
        year: 2022,
        revenue: 3_820_000,
        cogs: 2_080_000,
        operatingExpenses: { payroll: 670_000, rent: 113_000, fleet: 99_000, admin: 88_000 },
        ownerSalary: 205_000,
        addBacks: [
          { label: "Owner country club dues", amount: 16_000, category: "PERSONAL_EXPENSE" },
          { label: "Depreciation", amount: 60_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 19_000, category: "INTEREST" },
          { label: "Income taxes", amount: 34_000, category: "TAX" },
        ],
      },
      {
        year: 2023,
        revenue: 4_050_000,
        cogs: 2_180_000,
        operatingExpenses: { payroll: 700_000, rent: 116_000, fleet: 104_000, admin: 92_000 },
        ownerSalary: 210_000,
        addBacks: [
          { label: "Owner country club dues", amount: 17_000, category: "PERSONAL_EXPENSE" },
          { label: "Legal dispute settlement", amount: 42_000, category: "ONE_TIME" },
          { label: "Depreciation", amount: 63_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 17_000, category: "INTEREST" },
          { label: "Income taxes", amount: 38_000, category: "TAX" },
        ],
      },
    ],
  },
  {
    title: "Family-Owned Plumbing & Drain Service",
    industry: "Plumbing",
    state: "AZ",
    imageUrl: "https://loremflickr.com/1200/800/plumber,plumbing,pipes?lock=32",
    yearFounded: 2003,
    employees: 11,
    reasonForSale: "Owner pursuing retirement; strong residential repeat base.",
    askingPrice: 1_350_000,
    years: [
      {
        year: 2021,
        revenue: 1_900_000,
        cogs: 1_010_000,
        operatingExpenses: { payroll: 360_000, rent: 60_000, fleet: 66_000, marketing: 44_000 },
        ownerSalary: 150_000,
        addBacks: [
          { label: "Owner phone & vehicle", amount: 11_000, category: "PERSONAL_EXPENSE" },
          { label: "Depreciation", amount: 38_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 9_000, category: "INTEREST" },
        ],
      },
      {
        year: 2022,
        revenue: 2_080_000,
        cogs: 1_090_000,
        operatingExpenses: { payroll: 380_000, rent: 62_000, fleet: 70_000, marketing: 50_000 },
        ownerSalary: 155_000,
        addBacks: [
          { label: "Owner phone & vehicle", amount: 12_000, category: "PERSONAL_EXPENSE" },
          { label: "Owner health insurance", amount: 14_000, category: "OWNER_COMP" },
          { label: "Depreciation", amount: 40_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 8_000, category: "INTEREST" },
        ],
      },
      {
        year: 2023,
        revenue: 2_260_000,
        cogs: 1_170_000,
        operatingExpenses: { payroll: 405_000, rent: 64_000, fleet: 74_000, marketing: 54_000 },
        ownerSalary: 160_000,
        addBacks: [
          { label: "Owner phone & vehicle", amount: 12_000, category: "PERSONAL_EXPENSE" },
          { label: "Owner health insurance", amount: 15_000, category: "OWNER_COMP" },
          { label: "Depreciation", amount: 43_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 7_000, category: "INTEREST" },
        ],
      },
    ],
  },
  {
    title: "Regional Pest Control Operator",
    industry: "Pest Control",
    state: "GA",
    imageUrl: "https://loremflickr.com/1200/800/pest,control,exterminator?lock=33",
    yearFounded: 2000,
    employees: 18,
    reasonForSale: "Owner retiring; ~70% revenue under recurring contracts.",
    askingPrice: 2_100_000,
    years: [
      {
        year: 2021,
        revenue: 2_400_000,
        cogs: 1_080_000,
        operatingExpenses: { payroll: 480_000, rent: 72_000, fleet: 90_000, marketing: 66_000 },
        ownerSalary: 170_000,
        addBacks: [
          { label: "Owner vehicle", amount: 13_000, category: "PERSONAL_EXPENSE" },
          { label: "Depreciation", amount: 46_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 12_000, category: "INTEREST" },
        ],
      },
      {
        year: 2022,
        revenue: 2_640_000,
        cogs: 1_170_000,
        operatingExpenses: { payroll: 510_000, rent: 74_000, fleet: 95_000, marketing: 72_000 },
        ownerSalary: 175_000,
        addBacks: [
          { label: "Owner vehicle", amount: 13_000, category: "PERSONAL_EXPENSE" },
          { label: "Spouse payroll (no-show)", amount: 36_000, category: "OWNER_COMP" },
          { label: "Depreciation", amount: 48_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 11_000, category: "INTEREST" },
        ],
      },
      {
        year: 2023,
        revenue: 2_900_000,
        cogs: 1_270_000,
        operatingExpenses: { payroll: 545_000, rent: 76_000, fleet: 100_000, marketing: 78_000 },
        ownerSalary: 180_000,
        addBacks: [
          { label: "Owner vehicle", amount: 14_000, category: "PERSONAL_EXPENSE" },
          { label: "Spouse payroll (no-show)", amount: 38_000, category: "OWNER_COMP" },
          { label: "Rebranding campaign", amount: 30_000, category: "ONE_TIME" },
          { label: "Depreciation", amount: 51_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 10_000, category: "INTEREST" },
        ],
      },
    ],
  },
  {
    title: "Regional Medical-Billing Services Firm",
    industry: "Medical Billing",
    state: "NC",
    imageUrl: "https://loremflickr.com/1200/800/medical,office,accounting?lock=34",
    yearFounded: 2009,
    employees: 27,
    reasonForSale: "Founder retiring; sticky multi-year provider contracts.",
    askingPrice: 2_900_000,
    years: [
      {
        year: 2021,
        revenue: 3_100_000,
        cogs: 1_240_000,
        operatingExpenses: { payroll: 720_000, rent: 96_000, software: 140_000, admin: 110_000 },
        ownerSalary: 210_000,
        addBacks: [
          { label: "Owner travel", amount: 15_000, category: "PERSONAL_EXPENSE" },
          { label: "Software amortization", amount: 52_000, category: "AMORTIZATION" },
          { label: "Interest", amount: 14_000, category: "INTEREST" },
        ],
      },
      {
        year: 2022,
        revenue: 3_380_000,
        cogs: 1_330_000,
        operatingExpenses: { payroll: 760_000, rent: 99_000, software: 150_000, admin: 116_000 },
        ownerSalary: 215_000,
        addBacks: [
          { label: "Owner travel", amount: 16_000, category: "PERSONAL_EXPENSE" },
          { label: "Owner health insurance", amount: 20_000, category: "OWNER_COMP" },
          { label: "Software amortization", amount: 54_000, category: "AMORTIZATION" },
          { label: "Interest", amount: 12_000, category: "INTEREST" },
        ],
      },
      {
        year: 2023,
        revenue: 3_720_000,
        cogs: 1_450_000,
        operatingExpenses: { payroll: 810_000, rent: 102_000, software: 162_000, admin: 122_000 },
        ownerSalary: 220_000,
        addBacks: [
          { label: "Owner travel", amount: 17_000, category: "PERSONAL_EXPENSE" },
          { label: "Owner health insurance", amount: 21_000, category: "OWNER_COMP" },
          { label: "Platform migration", amount: 58_000, category: "ONE_TIME" },
          { label: "Software amortization", amount: 56_000, category: "AMORTIZATION" },
          { label: "Interest", amount: 10_000, category: "INTEREST" },
        ],
      },
    ],
  },
  {
    title: "Two-Location Electrical Contractor",
    industry: "Electrical",
    state: "PA",
    imageUrl: "https://loremflickr.com/1200/800/electrician,electrical,wiring?lock=35",
    yearFounded: 1995,
    employees: 19,
    reasonForSale: "Owner retiring; mix of commercial service and new construction.",
    askingPrice: 2_250_000,
    years: [
      {
        year: 2021,
        revenue: 3_000_000,
        cogs: 1_680_000,
        operatingExpenses: { payroll: 540_000, rent: 90_000, fleet: 84_000, admin: 72_000 },
        ownerSalary: 185_000,
        addBacks: [
          { label: "Owner vehicle & fuel", amount: 14_000, category: "PERSONAL_EXPENSE" },
          { label: "Depreciation", amount: 54_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 16_000, category: "INTEREST" },
        ],
      },
      {
        year: 2022,
        revenue: 3_240_000,
        cogs: 1_790_000,
        operatingExpenses: { payroll: 565_000, rent: 92_000, fleet: 88_000, admin: 76_000 },
        ownerSalary: 190_000,
        addBacks: [
          { label: "Owner vehicle & fuel", amount: 15_000, category: "PERSONAL_EXPENSE" },
          { label: "Depreciation", amount: 56_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 15_000, category: "INTEREST" },
        ],
      },
      {
        year: 2023,
        revenue: 3_500_000,
        cogs: 1_910_000,
        operatingExpenses: { payroll: 600_000, rent: 95_000, fleet: 92_000, admin: 80_000 },
        ownerSalary: 195_000,
        addBacks: [
          { label: "Owner vehicle & fuel", amount: 15_000, category: "PERSONAL_EXPENSE" },
          { label: "Second-shop opening costs", amount: 44_000, category: "ONE_TIME" },
          { label: "Depreciation", amount: 60_000, category: "DEPRECIATION" },
          { label: "Interest", amount: 13_000, category: "INTEREST" },
        ],
      },
    ],
  },
];

async function main() {
  console.log("Seeding database…");

  // Clean slate (dev only).
  await prisma.message.deleteMany();
  await prisma.unlockRequest.deleteMany();
  await prisma.document.deleteMany();
  await prisma.addBack.deleteMany();
  await prisma.financials.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.create({
    data: { email: "admin@chronos.test", name: "Avery Admin", role: "ADMIN", passwordHash },
  });
  const seller1 = await prisma.user.create({
    data: { email: "seller1@chronos.test", name: "Sam Seller", role: "SELLER", passwordHash },
  });
  const seller2 = await prisma.user.create({
    data: { email: "seller2@chronos.test", name: "Brooke Broker", role: "SELLER", passwordHash },
  });
  await prisma.user.create({
    data: { email: "buyer1@chronos.test", name: "Bailey Buyer", role: "BUYER", passwordHash },
  });
  await prisma.user.create({
    data: { email: "buyer2@chronos.test", name: "Quinn Acquirer", role: "BUYER", passwordHash },
  });

  const sellers = [seller1, seller2];

  for (let i = 0; i < listings.length; i++) {
    const l = listings[i];
    const seller = sellers[i % sellers.length];
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: l.title,
        industry: l.industry,
        state: l.state,
        yearFounded: l.yearFounded,
        employees: l.employees,
        reasonForSale: l.reasonForSale,
        askingPrice: l.askingPrice,
        status: "VERIFIED",
        isVerified: true,
        imageUrl: l.imageUrl ?? null,
        financials: {
          create: l.years.map((y) => ({
            year: y.year,
            revenue: y.revenue,
            cogs: y.cogs,
            operatingExpenses: JSON.stringify(y.operatingExpenses),
            ownerSalary: y.ownerSalary,
          })),
        },
        addBacks: {
          create: l.years.flatMap((y) =>
            y.addBacks.map((ab) => ({
              year: y.year,
              label: ab.label,
              amount: ab.amount,
              category: ab.category,
              note: ab.note ?? null,
            }))
          ),
        },
      },
    });
    console.log(`  ✓ ${listing.title}`);
  }

  console.log("\nDone. Login credentials (all password: password123):");
  console.log("  ADMIN   admin@chronos.test");
  console.log("  SELLER  seller1@chronos.test / seller2@chronos.test");
  console.log("  BUYER   buyer1@chronos.test / buyer2@chronos.test");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
