'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotForm) => {
    setLoading(true);
    try {
      // Simulate reset link send
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Decorative background blobs */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Sajilo Biz"
              className="h-24 w-auto object-contain dark:brightness-110"
            />
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Reset Password
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We will email you link instructions to reset your password.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-8 shadow-xl">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-foreground">Link Sent!</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Check your inbox! We've sent password reset instructions to your email address.
              </p>
              <div className="pt-4">
                <Link
                  href="/auth/login"
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Mail size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    {...register('email')}
                    className={`block w-full rounded-xl border bg-background/50 pl-10 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${errors.email ? 'border-destructive' : 'border-border'
                      }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  'Send Instructions'
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
        {/* Orbya Tech Co-branding */}
        <div className="flex flex-col items-center justify-center pt-2">
          <span className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest font-semibold">Developed By</span>
          <a
            href="https://orbyatech.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-transparent py-1 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img
              src="/orbya-light.png"
              alt="Orbya Tech"
              className="h-8 w-auto object-contain dark:hidden block"
            />
            <img
              src="/orbya-dark.png"
              alt="Orbya Tech"
              className="h-8 w-auto object-contain hidden dark:block"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
