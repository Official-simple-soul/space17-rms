"use client";

import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/field";
import { updateProfile } from "../actions";

export function ProfileForm({
  name,
  phone,
  email,
}: {
  name: string;
  phone: string;
  email: string;
}) {
  return (
    <ActionForm action={updateProfile} submit="Save profile">
      {(state) => (
        <>
          <TextField
            label="Full name"
            name="fullName"
            defaultValue={name}
            autoComplete="name"
            errors={state.fieldErrors?.fullName}
          />
          <TextField label="Email" name="email" value={email} readOnly className="bg-neutral-100" />
          <TextField
            label="Phone (optional)"
            name="phone"
            type="tel"
            defaultValue={phone}
            autoComplete="tel"
            errors={state.fieldErrors?.phone}
          />
        </>
      )}
    </ActionForm>
  );
}
