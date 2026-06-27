-- Migration 006: Remove transaction_id from registrations (redundant with payments.razorpay_payment_id)
ALTER TABLE registrations DROP COLUMN IF EXISTS transaction_id;
