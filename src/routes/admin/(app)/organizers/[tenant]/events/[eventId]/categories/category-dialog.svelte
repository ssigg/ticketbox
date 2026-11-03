<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { CATEGORY_COLORS } from '#lib/category-colors.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { locales } from '#lib/paraglide/runtime.js';
	import { cn } from '#lib/utils.ts';

	interface Props {
		/** Absent for a new category. */
		id?: string;
		values: Record<string, string>;
		defaultLocale: string;
		currency: string;
		title: string;
		submitLabel: string;
		trigger: Snippet<[Record<string, unknown>]>;
	}
	let { id, values, defaultLocale, currency, title, submitLabel, trigger }: Props = $props();

	const orderedLocales = $derived([defaultLocale, ...locales.filter((l) => l !== defaultLocale)]);
	const formId = $props.id();
	// Same order as CATEGORY_COLORS.
	const colorNames = [m.color_blue, m.color_red, m.color_green, m.color_amber, m.color_purple, m.color_cyan, m.color_pink, m.color_grey];

	let open = $state(false);
	let pending = $state(false);
	let form = $state<Record<string, string>>({});
	let errors = $state<Partial<Record<string, boolean>>>({});

	function reset() {
		form = { ...values };
		errors = {};
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => o && reset()}>
	<Dialog.Trigger>
		{#snippet child({ props })}{@render trigger(props)}{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action={id ? '?/update' : '?/create'}
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
						bind:value={form[`name.${locale}`]}
						required={locale === defaultLocale}
						maxlength={100}
						aria-invalid={errors[`name.${locale}`]}
					/>
				</div>
			{/each}
			<div class="grid gap-2">
				<Label for="{formId}-price">{m.price()} ({currency})</Label>
				<Input
					id="{formId}-price"
					name="price"
					inputmode="decimal"
					placeholder="45.00"
					bind:value={form.price}
					required
					aria-invalid={errors.price}
				/>
			</div>
			<fieldset class="grid gap-2">
				<legend class="mb-2 text-sm font-medium">{m.color()}</legend>
				<div class="flex flex-wrap gap-2">
					{#each CATEGORY_COLORS as color, i (color)}
						<label
							title={colorNames[i]()}
							class={cn(
								'size-8 cursor-pointer rounded-full ring-offset-2 ring-offset-background has-checked:ring-2 has-checked:ring-ring has-focus-visible:ring-2 has-focus-visible:ring-ring'
							)}
							style:background-color={color}
						>
							<input type="radio" name="color" value={color} bind:group={form.color} class="sr-only" required />
							<span class="sr-only">{colorNames[i]()}</span>
						</label>
					{/each}
				</div>
			</fieldset>
			{#if Object.keys(errors).length}
				<Alert.Root variant="destructive">
					<Alert.Description>{errors.price && Object.keys(errors).length === 1 ? m.invalid_price() : m.check_input()}</Alert.Description>
				</Alert.Root>
			{/if}
			<Dialog.Footer>
				<Button type="submit" disabled={pending}>{submitLabel}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
