-- Keep the invoice date validation trigger on a fixed, explicit search path.
alter function public.validate_invoice_dates() set search_path = public;
