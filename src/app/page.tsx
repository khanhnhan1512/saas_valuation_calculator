import { AspenCard } from '@/components/aspen/aspen-card';
import { CalculatorApp } from '@/components/calculator/calculator-app';

export default function HomePage() {
  return <CalculatorApp aspenCard={<AspenCard />} />;
}
