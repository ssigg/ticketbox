<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { locales } from '#lib/paraglide/runtime.js';
	import { slugify } from '#lib/slug.ts';
	import { EVENT_STATUSES, statusDescription, statusLabel, type EventStatus } from './status';

	interface Props {
		values: Record<string, string>;
		errors?: Partial<Record<string, boolean>>;
		defaultLocale: string;
		timezone: string;
		/** Derive the slug from the name until it is edited (new events only). */
		autoSlug: boolean;
		submitLabel: string;
		saved?: boolean;
	}
	let { values, errors = {}, defaultLocale, timezone, autoSlug, submitLabel, saved = false }: Props = $props();

	const languageNames: Record<string, string> = { en: 'English', de: 'Deutsch' };
	// Default language first: its name is required, the others fall back to it.
	const orderedLocales = $derived([defaultLocale, ...locales.filter((l) => l !== defaultLocale)]);

	let form = $state<Record<string, string>>({});
	let slugEdited = $state(false);
	$effect.pre(() => {
		form = { status: 'draft', ...values };
		slugEdited = !autoSlug;
	});

	let pending = $state(false);
	const invalid = (key: string) => (errors[key] ? true : undefined);
	const hasErrors = $derived(Object.keys(errors).length > 0);
</script>

<form
	method="POST"
	class="grid max-w-3xl gap-6"
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			pending = false;
			await update({ reset: false });
		};
	}}
>
	{#each orderedLocales as locale (locale)}
		<Card.Root>
			<Card.Header>
				<Card.Title><h2 lang={locale}>{languageNames[locale]}</h2></Card.Title>
				{#if locale !== defaultLocale}
					<Card.Description>{m.translation_optional({ language: languageNames[defaultLocale] })}</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content class="grid gap-4">
				<div class="grid gap-2">
					<Label for="name-{locale}">{m.event_name()} ({locale.toUpperCase()})</Label>
					<Input
						id="name-{locale}"
						name="name.{locale}"
						lang={locale}
						bind:value={form[`name.${locale}`]}
						oninput={() => locale === defaultLocale && !slugEdited && (form.slug = slugify(form[`name.${locale}`] ?? ''))}
						required={locale === defaultLocale}
						maxlength={200}
						aria-invalid={invalid(`name.${locale}`)}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="description-{locale}">{m.description()} ({locale.toUpperCase()})</Label>
					<Textarea
						id="description-{locale}"
						name="description.{locale}"
						lang={locale}
						rows={4}
						bind:value={form[`description.${locale}`]}
						maxlength={5000}
						aria-invalid={invalid(`description.${locale}`)}
					/>
				</div>
			</Card.Content>
		</Card.Root>
	{/each}

	<Card.Root>
		<Card.Header>
			<Card.Title><h2>{m.event_details()}</h2></Card.Title>
			<Card.Description>{m.times_in_zone({ timezone })}</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-4 sm:grid-cols-2">
			<div class="grid gap-2 sm:col-span-2">
				<Label for="slug">{m.slug()}</Label>
				<Input
					id="slug"
					name="slug"
					bind:value={form.slug}
					oninput={() => (slugEdited = true)}
					required
					minlength={2}
					maxlength={60}
					pattern={'[a-z0-9]+(-[a-z0-9]+)*'}
					aria-invalid={invalid('slug') ?? invalid('slugTaken')}
				/>
			</div>
			<div class="grid gap-2 sm:col-span-2">
				<Label for="venue">{m.venue()}</Label>
				<Input id="venue" name="venue" bind:value={form.venue} maxlength={200} aria-invalid={invalid('venue')} />
			</div>
			<div class="grid gap-2">
				<Label for="startsAt">{m.starts_at()}</Label>
				<Input id="startsAt" name="startsAt" type="datetime-local" bind:value={form.startsAt} required aria-invalid={invalid('startsAt')} />
			</div>
			<div class="grid gap-2">
				<Label for="status">{m.status()}</Label>
				<input type="hidden" name="status" value={form.status} />
				<Select.Root type="single" bind:value={form.status}>
					<Select.Trigger id="status" class="w-full">{statusLabel[form.status as EventStatus]?.()}</Select.Trigger>
					<Select.Content>
						{#each EVENT_STATUSES as s (s)}
							<Select.Item value={s} label={statusLabel[s]()}>
								<div class="grid">
									<span>{statusLabel[s]()}</span>
									<span class="text-xs text-muted-foreground">{statusDescription[s]()}</span>
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="grid gap-2">
				<Label for="salesStart">{m.sales_start()}</Label>
				<Input id="salesStart" name="salesStart" type="datetime-local" bind:value={form.salesStart} aria-invalid={invalid('salesStart')} aria-describedby="salesStart-hint" />
				<p id="salesStart-hint" class="text-xs text-muted-foreground">{m.sales_start_hint()}</p>
			</div>
			<div class="grid gap-2">
				<Label for="salesEnd">{m.sales_end()}</Label>
				<Input id="salesEnd" name="salesEnd" type="datetime-local" bind:value={form.salesEnd} aria-invalid={invalid('salesEnd')} aria-describedby="salesEnd-hint" />
				<p id="salesEnd-hint" class="text-xs text-muted-foreground">{m.sales_end_hint()}</p>
			</div>
		</Card.Content>
	</Card.Root>

	{#if errors.slugTaken}
		<Alert.Root variant="destructive"><Alert.Description>{m.event_slug_taken()}</Alert.Description></Alert.Root>
	{:else if errors.salesEnd && Object.keys(errors).length === 1}
		<Alert.Root variant="destructive"><Alert.Description>{m.sales_end_before_start()}</Alert.Description></Alert.Root>
	{:else if hasErrors}
		<Alert.Root variant="destructive"><Alert.Description>{m.check_input()}</Alert.Description></Alert.Root>
	{:else if saved}
		<Alert.Root role="status"><Alert.Description>{m.event_saved()}</Alert.Description></Alert.Root>
	{/if}

	<div>
		<Button type="submit" disabled={pending}>{submitLabel}</Button>
	</div>
</form>
