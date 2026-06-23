process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://chess:chess@localhost:5432/chess_test';
process.env.ADMIN_PASSWORD = 'admin';
process.env.NODE_ENV = 'test';
