CREATE TABLE "usage_alerts" (
	"org_id" text NOT NULL,
	"period" text NOT NULL,
	"threshold" integer NOT NULL,
	"alerted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usage_alerts_org_id_period_pk" PRIMARY KEY("org_id","period")
);
