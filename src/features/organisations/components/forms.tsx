"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { slugify } from "@/lib/format";
import { acceptInvite, registerFromInvite, requestAccess, updateOrganisation } from "../actions";

export function RegisterForm({ token, email }: { token: string; email: string }) {
  return (
    <ActionForm action={registerFromInvite} submit="Create account" fullWidth>
      {(state) => (
        <>
          <input type="hidden" name="token" value={token} />
          <TextField
            label="Email"
            name="email"
            value={email}
            readOnly
            autoComplete="username"
            className="bg-neutral-100"
          />
          <TextField
            label="Full name"
            name="fullName"
            autoComplete="name"
            errors={state.fieldErrors?.fullName}
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="At least 10 characters."
            errors={state.fieldErrors?.password}
          />
        </>
      )}
    </ActionForm>
  );
}

export function CreateOrganisationForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [custom, setCustom] = useState<string>();
  return (
    <ActionForm action={acceptInvite} submit="Create organisation" fullWidth>
      {(state) => (
        <>
          <input type="hidden" name="token" value={token} />
          <TextField
            label="Organisation name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            errors={state.fieldErrors?.name}
          />
          <TextField
            label="Organisation link name"
            name="slug"
            value={custom ?? slugify(name)}
            onChange={(e) => setCustom(e.target.value)}
            hint="Used in your organisation's link. It can't be changed later."
            errors={state.fieldErrors?.slug}
          />
        </>
      )}
    </ActionForm>
  );
}

type Organisation = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  fiscal_year_start_month: number;
};
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function OrganisationForm({ organisation }: { organisation: Organisation }) {
  return (
    <ActionForm action={updateOrganisation} submit="Save changes">
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={organisation.id} />
          <input type="hidden" name="slug" value={organisation.slug} />
          <TextField
            label="Organisation name"
            name="name"
            defaultValue={organisation.name}
            errors={state.fieldErrors?.name}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Currency"
              name="currency"
              value={organisation.currency}
              readOnly
              className="bg-neutral-100"
            />
            <SelectField
              label="Financial year starts"
              name="fiscalMonth"
              defaultValue={organisation.fiscal_year_start_month}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField
            label="Timezone"
            name="timezone"
            defaultValue={organisation.timezone}
            errors={state.fieldErrors?.timezone}
          />
        </>
      )}
    </ActionForm>
  );
}

export function AccessRequestForm() {
  return (
    <ActionForm action={requestAccess} submit="Request access" fullWidth>
      {(state) =>
        state.ok ? null : (
          <>
            <TextField
              label="Organisation name"
              name="orgName"
              autoComplete="organization"
              errors={state.fieldErrors?.orgName}
            />
            <TextField
              label="Your name"
              name="contactName"
              autoComplete="name"
              errors={state.fieldErrors?.contactName}
            />
            <TextField
              label="Work email"
              name="email"
              type="email"
              autoComplete="email"
              errors={state.fieldErrors?.email}
            />
            <TextArea
              label="How would you use it? (optional)"
              name="message"
              maxLength={1000}
              errors={state.fieldErrors?.message}
            />
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="absolute -left-[9999px]"
            />
          </>
        )
      }
    </ActionForm>
  );
}
