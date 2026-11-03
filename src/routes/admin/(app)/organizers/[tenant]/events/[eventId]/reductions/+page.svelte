<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { localized } from '#lib/localized.ts';
	import { formatMoney } from '#lib/money.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { appliesTo, reducedPrice } from '#lib/pricing.ts';
	import ReductionDialog from './reduction-dialog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = getLocale();
	const nameOf = (name: Partial<Record<string, string>>) => localized(name, locale, data.tenant.defaultLocale);
	const money = (minor: number) => formatMoney(minor, data.tenant.currency, locale);
	const percent = (basisPoints: number) =>
		new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(basisPoints / 10000);
	const describe = (r: { kind: 'percent' | 'absolute'; value: number }) =>
		`− ${r.kind === 'percent' ? percent(r.value) : money(r.value)}`;
</script>

<div class="mb-4 flex items-center justify-between gap-4">
	<p class="text-sm text-muted-foreground">{m.reductions_description()}</p>
	<ReductionDialog
		values={{}}
		categories={data.categories}
		defaultLocale={data.tenant.defaultLocale}
		currency={data.tenant.currency}
		title={m.new_reduction()}
		submitLabel={m.create()}
	>
		{#snippet trigger(props)}
			<Button {...props}><Plus /> {m.new_reduction()}</Button>
		{/snippet}
	</ReductionDialog>
</div>

{#if data.reductions.length === 0}
	<Card.Root><Card.Content class="text-muted-foreground">{m.no_reductions()}</Card.Content></Card.Root>
{:else}
	<Card.Root class="py-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{m.reduction()}</Table.Head>
					<Table.Head>{m.reduction_amount()}</Table.Head>
					<Table.Head class="hidden md:table-cell">{m.applies_to()}</Table.Head>
					<Table.Head><span class="sr-only">{m.actions()}</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.reductions as reduction, i (reduction.id)}
					{@const name = nameOf(reduction.name)}
					<Table.Row>
						<Table.Cell class="font-medium">{name}</Table.Cell>
						<Table.Cell class="tabular-nums">{describe(reduction)}</Table.Cell>
						<Table.Cell class="hidden md:table-cell">
							{#if reduction.allCategories}
								{m.all_categories()}
							{:else}
								<span class="flex flex-wrap gap-x-3 gap-y-1">
									{#each data.categories.filter((c) => reduction.categoryIds.includes(c.id)) as category (category.id)}
										<span class="flex items-center gap-1">
											<span class="size-2.5 rounded-full" style:background-color={category.color} aria-hidden="true"></span>
											{nameOf(category.name)}
										</span>
									{/each}
								</span>
							{/if}
						</Table.Cell>
						<Table.Cell>
							<div class="flex justify-end gap-1">
								<form method="POST" action="?/move" use:enhance class="contents">
									<input type="hidden" name="id" value={reduction.id} />
									<Button type="submit" name="direction" value="up" variant="ghost" size="icon-sm" disabled={i === 0} aria-label={`${m.move_up()}: ${name}`} title={m.move_up()}><ArrowUp /></Button>
									<Button type="submit" name="direction" value="down" variant="ghost" size="icon-sm" disabled={i === data.reductions.length - 1} aria-label={`${m.move_down()}: ${name}`} title={m.move_down()}><ArrowDown /></Button>
								</form>
								<ReductionDialog
									id={reduction.id}
									values={reduction.values}
									categories={data.categories}
									defaultLocale={data.tenant.defaultLocale}
									currency={data.tenant.currency}
									title={m.edit_reduction()}
									submitLabel={m.save()}
								>
									{#snippet trigger(props)}
										<Button {...props} variant="ghost" size="icon-sm" aria-label={`${m.edit()}: ${name}`} title={m.edit()}><Pencil /></Button>
									{/snippet}
								</ReductionDialog>
								<AlertDialog.Root>
									<AlertDialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })} aria-label={`${m.delete()}: ${name}`} title={m.delete()}>
										<Trash2 />
									</AlertDialog.Trigger>
									<AlertDialog.Content>
										<AlertDialog.Header>
											<AlertDialog.Title>{m.delete_reduction_confirm({ name })}</AlertDialog.Title>
										</AlertDialog.Header>
										<form method="POST" action="?/delete" use:enhance>
											<input type="hidden" name="id" value={reduction.id} />
											<AlertDialog.Footer>
												<AlertDialog.Cancel type="button">{m.cancel()}</AlertDialog.Cancel>
												<AlertDialog.Action type="submit" class={buttonVariants({ variant: 'destructive' })}>{m.delete()}</AlertDialog.Action>
											</AlertDialog.Footer>
										</form>
									</AlertDialog.Content>
								</AlertDialog.Root>
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>
{/if}

{#if data.categories.length > 0}
	<h3 class="mt-8 mb-1 font-semibold">{m.price_overview()}</h3>
	<p class="mb-3 text-sm text-muted-foreground">{m.price_overview_description()}</p>
	<Card.Root class="overflow-x-auto py-0">
		<Table.Root aria-label={m.price_overview()}>
			<Table.Header>
				<Table.Row>
					<Table.Head>{m.category()}</Table.Head>
					<Table.Head class="text-right">{m.full_price()}</Table.Head>
					{#each data.reductions as reduction (reduction.id)}
						<Table.Head class="text-right">{nameOf(reduction.name)}</Table.Head>
					{/each}
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.categories as category (category.id)}
					<Table.Row>
						<Table.Head scope="row" class="font-medium text-foreground">
							<span class="flex items-center gap-2">
								<span class="size-3 rounded-full" style:background-color={category.color} aria-hidden="true"></span>
								{nameOf(category.name)}
							</span>
						</Table.Head>
						<Table.Cell class="text-right tabular-nums">{money(category.price)}</Table.Cell>
						{#each data.reductions as reduction (reduction.id)}
							<Table.Cell class="text-right tabular-nums">
								{#if appliesTo(reduction, category.id)}
									{money(reducedPrice(category.price, reduction, data.tenant.currency))}
								{:else}
									<span class="text-muted-foreground" aria-label={m.not_available()}>–</span>
								{/if}
							</Table.Cell>
						{/each}
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>
{/if}
