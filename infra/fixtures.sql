CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO users(id,name,email,password,role,status) VALUES
('10000000-0000-4000-8000-000000000001','Duvan Mesa','admin@dev.local',crypt('DevAdmin123!',gen_salt('bf',10)),'ADMIN','ACTIVE'),
('10000000-0000-4000-8000-000000000002','Valentina Rojas','auditor@dev.local',crypt('DevReview123!',gen_salt('bf',10)),'REVIEWER','ACTIVE'),
('10000000-0000-4000-8000-000000000003','Santiago Torres','usuario@dev.local',crypt('DevMember123!',gen_salt('bf',10)),'MEMBER','ACTIVE');
INSERT INTO accounts.accounts(id,user_id,account_type) VALUES
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','SAVINGS'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','CHECKING');
