import { addMembership, createUser, uniqueEmail } from '../helpers/db';
import { extractLink, waitForMail } from '../helpers/inbucket';
import { expect, login, test } from './fixtures';

// The fixture user is the organizer's owner.

test('owners invite a new member who then sets a password and signs in', async ({ page, browser, user, tenant }) => {
	const email = uniqueEmail('invitee');
	await login(page, user.email, user.password);
	await page.getByRole('link', { name: new RegExp(tenant.name) }).click();
	await page.getByRole('link', { name: 'Members' }).click();

	await page.getByRole('button', { name: 'Invite member' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Email').fill(email);
	await dialog.getByLabel('Name').fill('Ina Vitee');
	await dialog.getByRole('button', { name: 'Invite' }).click();

	await expect(page.getByRole('status')).toHaveText(`Invitation sent to ${email}.`);
	const row = page.getByRole('row', { name: /Ina Vitee/ });
	await expect(row).toContainText('Invitation pending');
	await expect(row.getByRole('combobox')).toHaveText('Admin');

	// The invitee accepts in their own browser.
	const invitee = await (await browser.newContext()).newPage();
	await invitee.goto(extractLink((await waitForMail(email)).body.text));
	await invitee.getByLabel('New password').fill('invitee-pass-1');
	await invitee.getByLabel('Repeat password').fill('invitee-pass-1');
	await invitee.getByRole('button', { name: 'Save password' }).click();
	await expect(invitee.getByRole('status')).toHaveText('Your password was changed.');
	await login(invitee, email, 'invitee-pass-1');
	await expect(invitee.getByRole('link', { name: new RegExp(tenant.name) })).toBeVisible();

	await page.reload();
	await expect(page.getByRole('row', { name: /Ina Vitee/ })).not.toContainText('Invitation pending');
});

test('owners change roles and remove members, but keep the last owner', async ({ page, user, tenant }) => {
	const colleague = await createUser({ name: 'Colin Colleague' });
	await addMembership(colleague.id, tenant.id, 'admin');
	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto(`/admin/organizers/${tenant.slug}/members`);

	// The only owner can be neither demoted nor removed: the controls are disabled…
	await expect(page.getByRole('combobox', { name: 'Role: Erika Muster' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Remove: Erika Muster' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Remove: Colin Colleague' })).toBeEnabled();
	// …and the server refuses it anyway.
	for (const [action, form] of [
		['remove', { userId: user.id }],
		['changeRole', { userId: user.id, role: 'admin' }]
	] as const) {
		const res = await page.request.post(`/admin/organizers/${tenant.slug}/members?/${action}`, {
			form,
			headers: { origin: 'http://localhost:4180', accept: 'application/json' }
		});
		expect(await res.json()).toMatchObject({ type: 'failure', status: 400 });
	}

	// With a second owner, the first one can be demoted again.
	await page.getByRole('combobox', { name: 'Role: Colin Colleague' }).click();
	await page.getByRole('option', { name: 'Owner' }).click();
	await expect(page.getByRole('status')).toHaveText('Role of Colin Colleague changed.');
	await expect(page.getByRole('combobox', { name: 'Role: Erika Muster' })).toBeEnabled();

	await page.getByRole('combobox', { name: 'Role: Colin Colleague' }).click();
	await page.getByRole('option', { name: 'Box office' }).click();
	await expect(page.getByRole('status')).toHaveText('Role of Colin Colleague changed.');

	await page.getByRole('button', { name: 'Remove: Colin Colleague' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click();
	await expect(page.getByRole('status')).toHaveText('Colin Colleague was removed.');
	await expect(page.getByRole('row', { name: /Colin Colleague/ })).toHaveCount(0);
});

test('only owners manage members', async ({ page, tenant }) => {
	const admin = await createUser({ name: 'Ada Admin' });
	await addMembership(admin.id, tenant.id, 'admin');
	await login(page, admin.email, admin.password);
	await page.getByRole('link', { name: new RegExp(tenant.name) }).click();
	await expect(page.getByRole('heading', { name: tenant.name })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Members' })).toHaveCount(0);

	expect((await page.goto(`/admin/organizers/${tenant.slug}/members`))?.status()).toBe(403);
	const res = await page.request.post(`/admin/organizers/${tenant.slug}/members?/invite`, {
		form: { email: uniqueEmail(), name: 'X', role: 'owner' },
		headers: { origin: 'http://localhost:4180' }
	});
	expect(res.status()).toBe(403);
});

test('an owner who steps down is taken back to the organizer', async ({ page, user, tenant }) => {
	const other = await createUser({ name: 'Otto Owner' });
	await addMembership(other.id, tenant.id, 'owner');
	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto(`/admin/organizers/${tenant.slug}/members`);

	await page.getByRole('combobox', { name: 'Role: Erika Muster' }).click();
	await page.getByRole('option', { name: 'Admin' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/organizers/${tenant.slug}$`));
	await expect(page.getByRole('link', { name: 'Members' })).toHaveCount(0);
});
