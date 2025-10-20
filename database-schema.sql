-- Virtual Studio AI Database Schema
-- This file contains the SQL schema for the Virtual Studio AI application

-- Users table for storing user accounts and preferences
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'solo' CHECK (plan IN ('solo', 'studio', 'brand')),
    generations_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User generations table for tracking AI generation usage
CREATE TABLE IF NOT EXISTS user_generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    generation_type VARCHAR(50) NOT NULL, -- 'apparel', 'product', 'design', 'video'
    prompt TEXT,
    settings JSONB, -- Store generation settings as JSON
    result_urls TEXT[], -- Array of generated image/video URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User models table for storing custom AI models
CREATE TABLE IF NOT EXISTS user_models (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    gender VARCHAR(20) CHECK (gender IN ('Male', 'Female')),
    image_url TEXT, -- Base64 or URL to model image
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User apparel items table
CREATE TABLE IF NOT EXISTS user_apparel (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('Top', 'Bottom', 'Full Body', 'Outerwear', 'Accessory', 'Footwear')),
    description TEXT,
    image_url TEXT, -- Base64 or URL to apparel image
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User scenes table for saving scene configurations
CREATE TABLE IF NOT EXISTS user_scenes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    scene_config JSONB NOT NULL, -- Store complete scene configuration
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON user_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON user_generations(created_at);
CREATE INDEX IF NOT EXISTS idx_models_user_id ON user_models(user_id);
CREATE INDEX IF NOT EXISTS idx_apparel_user_id ON user_apparel(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_user_id ON user_scenes(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_apparel ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scenes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own generations" ON user_generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own generations" ON user_generations FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own models" ON user_models FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can insert own models" ON user_models FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own models" ON user_models FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own apparel" ON user_apparel FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own apparel" ON user_apparel FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own scenes" ON user_scenes FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can insert own scenes" ON user_scenes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scenes" ON user_scenes FOR UPDATE USING (auth.uid() = user_id);

-- Insert a demo user for testing
INSERT INTO users (id, email, plan, generations_used) 
VALUES (
    'demo-user-premium-456'::UUID,
    'demo@virtualstudio.ai',
    'brand',
    0
) ON CONFLICT (email) DO UPDATE SET
    plan = EXCLUDED.plan,
    generations_used = EXCLUDED.generations_used;
