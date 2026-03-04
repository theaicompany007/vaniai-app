'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function useOrg(): string | null {
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !mounted) return;
      supabase
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (mounted) setOrgId(data?.org_id ?? null);
        });
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  return orgId;
}

export function useUser() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user)).catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return user;
}
