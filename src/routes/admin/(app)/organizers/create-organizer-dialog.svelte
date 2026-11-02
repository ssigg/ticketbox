<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus } from '@lucide/svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, locales } from '#lib/paraglide/runtime.js';
	import { slugify } from '#lib/slug.ts';

	type Errors = Partial<Record<'name' | 'slug' | 'defaultLocale' | 'currency' | 'slugTaken', true>>;

	let open = $state(false);
	let pending = $state(false);
	let errors = $state<Errors>({});

	let name = $state('');
	let slug = $state('');
	// Follow the name until the user edits the slug themselves.
	let slugEdited = $state(false);
	let defaultLocale = $state<string>(getLocale());
	let currency = $state('CHF');

	const languageNames: Record<string, string> = { en: 'English', de: 'Deutsch' };

	function reset() {
		name = slug = '';
		slugEdited = false;
		defaultLocale = getLocale();
		currency = 'CHF';
		errors = {};
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => o && reset()}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props}><Plus /> {m.new_organizer()}</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.new_organizer()}</Dialog.Title>
			<Dialog.Description>{m.new_organizer_description()}</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			class="grid gap-4"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'failure') errors = (result.data?.errors as Errors) ?? {};
					else {
						open = false;
						await update();
					}
				};
			}}
		>
			<div class="grid gap-2">
				<Label for="organizer-name">{m.name()}</Label>
				<Input
					id="organizer-name"
					name="name"
					bind:value={name}
					oninput={() => !slugEdited && (slug = slugify(name))}
					aria-invalid={errors.name}
					required
					maxlength={100}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="organizer-slug">{m.slug()}</Label>
				<Input
					id="organizer-slug"
					name="slug"
					bind:value={slug}
					oninput={() => (slugEdited = true)}
					aria-invalid={errors.slug || errors.slugTaken}
					aria-describedby="organizer-slug-hint"
					required
					pattern={'[a-z0-9]+(-[a-z0-9]+)*'}
					minlength={2}
					maxlength={60}
				/>
				<p id="organizer-slug-hint" class="text-sm text-muted-foreground">
					/admin/organizers/{slug || '…'}
				</p>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label for="organizer-locale">{m.default_language()}</Label>
					<Select.Root type="single" name="defaultLocale" bind:value={defaultLocale}>
						<Select.Trigger id="organizer-locale" class="w-full">{languageNames[defaultLocale]}</Select.Trigger>
						<Select.Content>
							{#each locales as locale (locale)}
								<Select.Item value={locale} label={languageNames[locale]} />
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="grid gap-2">
					<Label for="organizer-currency">{m.currency()}</Label>
					<Select.Root type="single" name="currency" bind:value={currency}>
						<Select.Trigger id="organizer-currency" class="w-full">{currency}</Select.Trigger>
						<Select.Content>
							<Select.Item value="CHF" label="CHF" />
							<Select.Item value="EUR" label="EUR" />
						</Select.Content>
					</Select.Root>
				</div>
			</div>
			{#if errors.slugTaken}
				<Alert.Root variant="destructive"><Alert.Description>{m.slug_taken()}</Alert.Description></Alert.Root>
			{:else if Object.keys(errors).length > 0}
				<Alert.Root variant="destructive"><Alert.Description>{m.check_input()}</Alert.Description></Alert.Root>
			{/if}
			<Dialog.Footer>
				<Button type="submit" disabled={pending}>{m.create()}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
