<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { CATEGORY_COLORS } from '#lib/category-colors.ts';
	import { localized } from '#lib/localized.ts';
	import { formatMoney } from '#lib/money.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import CategoryDialog from './category-dialog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const nameOf = (name: Partial<Record<string, string>>) => localized(name, getLocale(), data.tenant.defaultLocale);
	// Suggest the first colour not used yet.
	const nextColor = $derived(
		CATEGORY_COLORS.find((c) => !data.categories.some((cat) => cat.color === c)) ?? CATEGORY_COLORS[0]
	);
</script>

<div class="mb-4 flex items-center justify-between gap-4">
	<p class="text-sm text-muted-foreground">{m.categories_description()}</p>
	<CategoryDialog
		values={{ color: nextColor }}
		defaultLocale={data.tenant.defaultLocale}
		currency={data.tenant.currency}
		title={m.new_category()}
		submitLabel={m.create()}
	>
		{#snippet trigger(props)}
			<Button {...props}><Plus /> {m.new_category()}</Button>
		{/snippet}
	</CategoryDialog>
</div>

{#if data.categories.length === 0}
	<Card.Root><Card.Content class="text-muted-foreground">{m.no_categories()}</Card.Content></Card.Root>
{:else}
	<Card.Root class="py-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{m.category()}</Table.Head>
					<Table.Head class="text-right">{m.price()}</Table.Head>
					<Table.Head><span class="sr-only">{m.actions()}</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.categories as category, i (category.id)}
					{@const name = nameOf(category.name)}
					<Table.Row>
						<Table.Cell class="font-medium">
							<span class="flex items-center gap-2">
								<span class="size-3 shrink-0 rounded-full" style:background-color={category.color} aria-hidden="true"></span>
								{name}
							</span>
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatMoney(category.price, data.tenant.currency, getLocale())}</Table.Cell>
						<Table.Cell>
							<div class="flex justify-end gap-1">
								<form method="POST" action="?/move" use:enhance class="contents">
									<input type="hidden" name="id" value={category.id} />
									<Button type="submit" name="direction" value="up" variant="ghost" size="icon-sm" disabled={i === 0} aria-label={`${m.move_up()}: ${name}`} title={m.move_up()}>
										<ArrowUp />
									</Button>
									<Button type="submit" name="direction" value="down" variant="ghost" size="icon-sm" disabled={i === data.categories.length - 1} aria-label={`${m.move_down()}: ${name}`} title={m.move_down()}>
										<ArrowDown />
									</Button>
								</form>
								<CategoryDialog
									id={category.id}
									values={category.values}
									defaultLocale={data.tenant.defaultLocale}
									currency={data.tenant.currency}
									title={m.edit_category()}
									submitLabel={m.save()}
								>
									{#snippet trigger(props)}
										<Button {...props} variant="ghost" size="icon-sm" aria-label={`${m.edit()}: ${name}`} title={m.edit()}>
											<Pencil />
										</Button>
									{/snippet}
								</CategoryDialog>
								<AlertDialog.Root>
									<AlertDialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })} aria-label={`${m.delete()}: ${name}`} title={m.delete()}>
										<Trash2 />
									</AlertDialog.Trigger>
									<AlertDialog.Content>
										<AlertDialog.Header>
											<AlertDialog.Title>{m.delete_category_confirm({ name })}</AlertDialog.Title>
										</AlertDialog.Header>
										<form method="POST" action="?/delete" use:enhance>
											<input type="hidden" name="id" value={category.id} />
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
