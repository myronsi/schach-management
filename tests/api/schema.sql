-- Guessed schema for local testing only (ids deliberately NOT auto-increment).
CREATE TABLE users (
  username VARCHAR(100) PRIMARY KEY,
  password VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'user',
  password_status VARCHAR(20) DEFAULT 'changed',
  first_name VARCHAR(100) DEFAULT '',
  last_name VARCHAR(100) DEFAULT '',
  email VARCHAR(255) NULL,
  notify_events TINYINT(1) DEFAULT 0
);
CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100), entity VARCHAR(50), entity_id TEXT,
  action VARCHAR(50), old_data LONGTEXT, new_data LONGTEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE edit_locks (
  entity VARCHAR(50), entity_id VARCHAR(64), username VARCHAR(100), lock_token VARCHAR(64),
  locked_at DATETIME, expires_at DATETIME, PRIMARY KEY (entity, entity_id)
);
CREATE TABLE news (
  id INT PRIMARY KEY, slug VARCHAR(200) UNIQUE, title VARCHAR(255), description TEXT, content LONGTEXT,
  date DATETIME, image VARCHAR(500), link VARCHAR(500),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, updated_by VARCHAR(100)
);
CREATE TABLE events (
  id INT PRIMARY KEY, title VARCHAR(255), date VARCHAR(30), time VARCHAR(50), location VARCHAR(255),
  description TEXT, type VARCHAR(50), is_recurring TINYINT(1) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, updated_by VARCHAR(100)
);
CREATE TABLE documents (
  id INT PRIMARY KEY, name VARCHAR(255), filename VARCHAR(255), filepath VARCHAR(500), category VARCHAR(100),
  description TEXT, file_size INT, upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_active TINYINT(1) DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, updated_by VARCHAR(100)
);
CREATE TABLE media (
  id INT PRIMARY KEY, src VARCHAR(500), title VARCHAR(255), description TEXT, children LONGTEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, updated_by VARCHAR(100)
);
CREATE TABLE teams (
  id INT PRIMARY KEY, name VARCHAR(255), text LONGTEXT, league VARCHAR(255), image VARCHAR(500), url VARCHAR(500),
  captain VARCHAR(255), contact VARCHAR(255), nextMatch VARCHAR(255), venue VARCHAR(255), record TEXT, squad TEXT,
  notes TEXT, founded INT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, updated_by VARCHAR(100)
);
CREATE TABLE tournaments (
  id INT PRIMARY KEY, type VARCHAR(50), year VARCHAR(10), first VARCHAR(255), second VARCHAR(255), third VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, updated_by VARCHAR(100)
);
CREATE TABLE fastinfo (
  id INT PRIMARY KEY, icon VARCHAR(100), label VARCHAR(255), targetValue INT, delay INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, updated_by VARCHAR(100)
);
CREATE TABLE history (
  id VARCHAR(40) PRIMARY KEY, date VARCHAR(50), text TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, updated_by VARCHAR(100)
);
CREATE TABLE membership_applications (
  id INT AUTO_INCREMENT PRIMARY KEY, first_name VARCHAR(255), last_name VARCHAR(255), address VARCHAR(255),
  postal_city VARCHAR(255), birth_date DATE, birth_place VARCHAR(255), phone VARCHAR(255), email VARCHAR(255),
  nationality VARCHAR(255), gender VARCHAR(20), previous_club VARCHAR(255), membership_type VARCHAR(50),
  application_place VARCHAR(255), application_date DATE, direct_debit TINYINT(1), bank_name VARCHAR(255),
  bic VARCHAR(50), iban VARCHAR(50), account_holder VARCHAR(255), signature LONGTEXT, guardian_signature LONGTEXT,
  debit_signature LONGTEXT, signed_at DATETIME, status VARCHAR(20) DEFAULT 'submitted',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, decided_at DATETIME NULL, decided_by VARCHAR(100) NULL
);
CREATE TABLE email_queue (
  id INT AUTO_INCREMENT PRIMARY KEY, event_id INT, email VARCHAR(255), subject VARCHAR(500), body LONGTEXT,
  created_at DATETIME, is_html TINYINT(1), sent TINYINT(1) DEFAULT 0, sent_at DATETIME NULL,
  failed TINYINT(1) DEFAULT 0, error_message TEXT
);
INSERT INTO news (id, slug, title, description, content, date) VALUES (1, 'erste', 'Erste', 'd', '<p>x</p>', '2026-01-01 10:00:00'), (2, 'zweite', 'Zweite', 'd', '<p>y</p>', '2026-02-01 10:00:00');
INSERT INTO documents (id, name, filename, filepath, category, is_active) VALUES (1, 'Satzung', 'satzung.pdf', '/docs/vereinsdokumente/satzung.pdf', 'vereinsdokumente', 1);
INSERT INTO events (id, title, date) VALUES (1, 'Training', '2026-12-01');
