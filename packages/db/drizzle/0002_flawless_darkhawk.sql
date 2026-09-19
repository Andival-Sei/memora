CREATE TABLE "document_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"vault_id" uuid NOT NULL,
	"blob_path" text NOT NULL,
	"page_index" integer NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"sha256" varchar(64) NOT NULL,
	"quality_status" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_assets_record_page_unique" UNIQUE("record_id","page_index"),
	CONSTRAINT "document_assets_record_sha256_unique" UNIQUE("record_id","sha256"),
	CONSTRAINT "document_assets_blob_path_unique" UNIQUE("blob_path")
);
--> statement-breakpoint
CREATE TABLE "document_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"schema_version" integer NOT NULL,
	"status" text DEFAULT 'empty' NOT NULL,
	"title" text,
	"issued_at" date,
	"expires_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_record_id_document_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."document_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_assets_vault_record_page_idx" ON "document_assets" USING btree ("vault_id","record_id","page_index");--> statement-breakpoint
CREATE INDEX "document_records_vault_created_at_idx" ON "document_records" USING btree ("vault_id","created_at");--> statement-breakpoint
CREATE INDEX "document_records_vault_type_status_idx" ON "document_records" USING btree ("vault_id","document_type","status");