'use client';

import { Ticket } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  batchOccupancy,
  batchPriceLabel,
  batchSoldLabel,
  productRevenueCents,
  revenueLabel,
} from '@/lib/products-breakdown';
import type { ProductAnalytics } from '@/lib/types';

const PRODUCT_COLORS = ['#10B981', '#8B5CF6', '#F59E0B', '#3B82F6', '#EF4444', '#EC4899'];

/**
 * "Produtos e Lotes" on the event analytics: one block per product, one row per
 * batch with price, occupancy and revenue. Money comes in cents (REA-17).
 */
export function ProductsBreakdownCard({ products }: { products: ProductAnalytics[] }) {
  if (products.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Ticket className="w-4 h-4 text-secondary" />
          Produtos e Lotes
        </CardTitle>
        <CardDescription>Vendas e receita por produto/lote</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length > 1 && <ProductsChart products={products} />}

        {products.map((product, index) => (
          <ProductBlock
            key={product.product_id}
            product={product}
            color={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ProductBlock({ product, color }: { product: ProductAnalytics; color: string }) {
  // With a single batch the batch row already carries the totals; the header only names it.
  const showTotals = product.batches.length > 1;

  return (
    <section
      aria-label={product.product_name}
      className="rounded-xl border border-border/50 overflow-hidden"
    >
      <header className="flex items-center gap-3 px-4 py-3 bg-muted/40">
        <span className="h-5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <p className="font-semibold text-sm truncate flex-1">{product.product_name}</p>
        {showTotals && (
          <p className="text-xs text-muted-foreground tabular-nums shrink-0">
            {product.total_signups} inscriç{product.total_signups === 1 ? 'ão' : 'ões'} ·{' '}
            {revenueLabel(productRevenueCents(product))}
          </p>
        )}
      </header>

      {product.batches.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {product.total_signups} inscriç{product.total_signups === 1 ? 'ão' : 'ões'}
        </p>
      ) : (
        <ul className="divide-y divide-border/50">
          {product.batches.map((batch) => {
            const occupancy = batchOccupancy(batch);
            return (
              <li
                key={batch.batch_id}
                className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[10rem_minmax(0,1fr)_8rem] items-center gap-x-6 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">Lote {batch.batch_number}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {batchPriceLabel(batch)}
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1 order-last sm:order-none space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                    <span>{batchSoldLabel(batch)}</span>
                    {occupancy !== null ? (
                      <span className="font-semibold">{occupancy}%</span>
                    ) : (
                      <span className="text-muted-foreground">sem limite</span>
                    )}
                  </div>
                  {occupancy !== null && (
                    <Progress
                      value={occupancy}
                      aria-label={`Ocupação do lote ${batch.batch_number}`}
                      className="h-1.5 bg-muted"
                    />
                  )}
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{revenueLabel(batch.revenue)}</p>
                  <p className="text-xs text-muted-foreground">Receita</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ProductsChart({ products }: { products: ProductAnalytics[] }) {
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={products.map((p) => ({
            name: p.product_name.length > 20 ? p.product_name.slice(0, 20) + '…' : p.product_name,
            inscritos: p.total_signups,
          }))}
          margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--card))',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="inscritos" fill="#8B5CF6" radius={[6, 6, 0, 0]} maxBarSize={60} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
