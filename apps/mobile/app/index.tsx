/**
 * Entry index — immediately hands control to the role/auth gate in the root
 * layout. Shows a spinner while it resolves; the navigator replaces this route
 * with (auth) or the role's home group.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth, roleHome } from '../lib/auth';
import { Loader } from '../components/Loader';

export default function Index() {
  const { loading, session, role, isConfigured } = useAuth();
  if (loading) return <Loader />;

  const authed = Boolean(session) || !isConfigured;
  if (!authed) return <Redirect href="/(auth)/login" />;
  const home = isConfigured ? roleHome(role) : '/(customer)';
  return <Redirect href={home as never} />;
}
