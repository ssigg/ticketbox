<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { localized } from '#lib/localized.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, locales } from '#lib/paraglide/runtime.js';

	type Values = Record<string, string | string[] | undefined>;
	interface Props {
		/** Absent for a new reduction. */
		id?: string;
		values: Values;
		categories: { id: string; name: Partial<Record<string, string>>; color: string }[];
		defaultLocale: string;
		currency: string;
		title: string;
		submitLabel: string;
		trigger: Snippet<[Record<string, unknown>]>;
	}
	let { id, values, categories, defaultLocale, currency, title, submitLabel, trigger }: Props = $props();

	const orderedLocales = $derived([defaultLocale, ...locales.filter((l) => l !== defaultLocale)]);
	const formId = $props.id();

	let open = $state(false);
	let pending = $state(false);
	let text = $state<Record<string, string>>({});
	let categoryIds = $state<string[]>([]);
	let errors = $state<Partial<Record<string, boolean>>>({});

	function reset() {
		text = Object.fromEntries(Object.entries(values).filter((e): e is [string, string] => typeof e[1] === 'string'));
		text.kind ??= 'percent';
		text.scope ??= 'all';
		categoryIds = Array.isArray(values.categoryIds) ? [...values.categoryIds] : [];
		errors = {};
	}

	const radio = 'size-4 accent-primary';
</script>

<Dialog.Root bind:open onOpenChange={(o) => o && reset()}>
	<Dialog.Trigger>
		{#snippet child({ props })}{@render trigger(props)}{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{m.reduction_hint()}</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/save"
			class="grid gap-4"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'failure') errors = (result.data?.errors as typeof errors) ?? {};
					else {
						open = false;
						await update();
					}
				};
			}}
		>
			{#if id}<input type="hidden" name="id" value={id} />{/if}
			{#each orderedLocales as locale (locale)}
				<div class="grid gap-2">
					<Label for="{formId}-name-{locale}">{m.event_name()} ({locale.toUpperCase()})</Label>
					<Input
						id="{formId}-name-{locale}"
						name="name.{locale}"
						lang={locale}
						bind:value={text[`name.${locale}`]}
						required={locale === defaultLocale}
						maxlength={100}
						aria-invalid={errors[`name.${locale}`]}
					/>
				</div>
			{/each}

			<fieldset class="grid gap-2">
				<legend class="mb-2 text-sm font-medium">{m.reduction_kind()}</legend>
				<label class="flex items-center gap-2 text-sm">
					<input type="radio" name="kind" value="percent" bind:group={text.kind} class={radio} />
					{m.reduction_percent()}
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input type="radio" name="kind" value="absolute" bind:group={text.kind} class={radio} />
					{m.reduction_absolute({ currency })}
				</label>
			</fieldset>

			<div class="grid gap-2">
				<Label for="{formId}-value">{text.kind === 'percent' ? m.reduction_value_percent() : m.reduction_value_absolute({ currency })}</Label>
				<Input
					id="{formId}-value"
					name="value"
					inputmode="decimal"
					placeholder={text.kind === 'percent' ? '20' : '10.00'}
					bind:value={text.value}
					required
					aria-invalid={errors.value}
				/>
			</div>

			<fieldset class="grid gap-2">
				<legend class="mb-2 text-sm font-medium">{m.applies_to()}</legend>
				<label class="flex items-center gap-2 text-sm">
					<input type="radio" name="scope" value="all" bind:group={text.scope} class={radio} />
					{m.all_categories()}
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input type="radio" name="scope" value="selected" bind:group={text.scope} class={radio} disabled={categories.length === 0} />
					{m.selected_categories()}
				</label>
				{#if text.scope === 'selected'}
					<div class="ml-6 grid gap-2">
						{#each categories as category (category.id)}
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" name="categoryIds" value={category.id} bind:group={categoryIds} class={radio} />
								<span class="size-3 rounded-full" style:background-color={category.color} aria-hidden="true"></span>
								{localized(category.name, getLocale(), defaultLocale)}
							</label>
						{/each}
					</div>
				{/if}
			</fieldset>

			{#if errors.categoryIds && Object.keys(errors).length === 1}
				<Alert.Root variant="destructive"><Alert.Description>{m.select_a_category()}</Alert.Description></Alert.Root>
			{:else if errors.value && Object.keys(errors).length === 1}
				<Alert.Root variant="destructive">
					<Alert.Description>{text.kind === 'percent' ? m.invalid_percent() : m.invalid_price()}</Alert.Description>
				</Alert.Root>
			{:else if Object.keys(errors).length}
				<Alert.Root variant="destructive"><Alert.Description>{m.check_input()}</Alert.Description></Alert.Root>
			{/if}
			<Dialog.Footer>
				<Button type="submit" disabled={pending}>{submitLabel}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
