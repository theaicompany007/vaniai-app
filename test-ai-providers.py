#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Provider Testing Script
Tests both OpenAI and Gemini API keys to verify they're working correctly

Usage:
    python test-ai-providers.py [--openai-key KEY] [--gemini-key KEY] [--env-file PATH]
    python test-ai-providers.py --help

Options:
    --openai-key KEY     OpenAI API key (or set OPENAI_API_KEY env var)
    --gemini-key KEY     Gemini API key (or set GEMINI_API_KEY env var)
    --env-file PATH      Path to .env.local file (default: .env.local in current dir)
    --help               Show this help message

Examples:
    # Test with environment variables
    python test-ai-providers.py

    # Test with explicit keys
    python test-ai-providers.py --openai-key sk-... --gemini-key AIza...

    # Test with custom env file
    python test-ai-providers.py --env-file /path/to/.env.local
"""

import os
import sys
import argparse
import time
from typing import Dict, Optional, Any
from pathlib import Path

# Fix Windows console encoding for Unicode characters
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

# Import AI libraries (will check later if needed)
openai = None
genai = None


def load_env_file(env_path: Path) -> Dict[str, str]:
    """Load environment variables from .env.local file"""
    env_vars = {}
    if not env_path.exists():
        return env_vars
    
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue
                # Parse KEY=VALUE
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    env_vars[key] = value
    except Exception as e:
        print(f"[WARN] Warning: Could not read {env_path}: {e}")
    
    return env_vars


def clean_api_key(key: str) -> str:
    """Clean API key: remove quotes, whitespace, newlines"""
    if not key:
        return ""
    key = key.strip()
    # Remove surrounding quotes
    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
        key = key[1:-1].strip()
    # Remove newlines
    key = key.replace('\n', '').replace('\r', '')
    return key


def test_openai(api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    """Test OpenAI API"""
    global openai
    
    if not openai:
        try:
            import openai
        except ImportError:
            return {
                'provider': 'OpenAI',
                'success': False,
                'error': 'openai package not installed. Install with: pip install openai',
            }
    
    print('\n[BLUE] Testing OpenAI API...')
    print('-' * 60)
    
    if not api_key:
        return {
            'provider': 'OpenAI',
            'success': False,
            'error': 'OPENAI_API_KEY not provided',
        }
    
    clean_key = clean_api_key(api_key)
    
    # Validate format
    if not clean_key.startswith('sk-'):
        return {
            'provider': 'OpenAI',
            'success': False,
            'error': f'Invalid API key format. Expected to start with "sk-", got: {clean_key[:10]}...',
        }
    
    try:
        client = openai.OpenAI(api_key=clean_key)
        test_model = model or os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
        
        print(f"  Model: {test_model}")
        print(f"  API Key: {clean_key[:10]}...{clean_key[-4:]}")
        
        start_time = time.time()
        response = client.chat.completions.create(
            model=test_model,
            messages=[
                {
                    'role': 'system',
                    'content': 'You are a helpful assistant. Respond briefly.',
                },
                {
                    'role': 'user',
                    'content': 'Say "OpenAI API is working!" in one sentence.',
                },
            ],
            temperature=0.7,
            max_tokens=50,
        )
        response_time = int((time.time() - start_time) * 1000)
        
        response_text = response.choices[0].message.content or ''
        
        print(f"  [OK] Response received in {response_time}ms")
        print(f"  Response: \"{response_text}\"")
        
        if response.usage:
            print(f"  Tokens used: {response.usage.total_tokens} "
                  f"(prompt: {response.usage.prompt_tokens}, "
                  f"completion: {response.usage.completion_tokens})")
        
        return {
            'provider': 'OpenAI',
            'success': True,
            'details': {
                'model': test_model,
                'response': response_text,
                'response_time': f'{response_time}ms',
                'tokens_used': response.usage.total_tokens if response.usage else None,
            },
        }
    except openai.AuthenticationError:
        return {
            'provider': 'OpenAI',
            'success': False,
            'error': 'Invalid API key. Please check your OPENAI_API_KEY',
        }
    except Exception as e:
        error_msg = str(e)
        print(f"  [ERROR] Error: {error_msg}")
        return {
            'provider': 'OpenAI',
            'success': False,
            'error': error_msg,
        }


def test_gemini(api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    """Test Gemini API"""
    global genai
    
    if not genai:
        try:
            import google.generativeai as genai
        except ImportError:
            return {
                'provider': 'Gemini',
                'success': False,
                'error': 'google-generativeai package not installed. Install with: pip install google-generativeai',
            }
    
    print('\n[GREEN] Testing Gemini API...')
    print('-' * 60)
    
    if not api_key:
        return {
            'provider': 'Gemini',
            'success': False,
            'error': 'GEMINI_API_KEY not provided',
        }
    
    clean_key = clean_api_key(api_key)
    
    # Validate format
    if not clean_key.startswith('AIza'):
        return {
            'provider': 'Gemini',
            'success': False,
            'error': f'Invalid API key format. Expected to start with "AIza", got: {clean_key[:10]}...',
        }
    
    try:
        requested_model = model or os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
        fallback_models = [
            'gemini-2.0-flash',
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-2.0-flash-exp',
            'gemini-1.5-flash',
            'gemini-pro',
        ]
        
        print(f"  Requested Model: {requested_model}")
        print(f"  API Key: {clean_key[:8]}...{clean_key[-4:]}")
        
        genai.configure(api_key=clean_key)
        models_to_try = [requested_model] + [m for m in fallback_models if m != requested_model]
        
        working_model = None
        response_text = ''
        response_time = 0
        
        for test_model in models_to_try:
            try:
                print(f"  Trying model: {test_model}...")
                model_instance = genai.GenerativeModel(test_model)
                
                start_time = time.time()
                result = model_instance.generate_content(
                    'Say "Gemini API is working!" in one sentence.',
                    generation_config={
                        'temperature': 0.7,
                        'max_output_tokens': 50,
                    }
                )
                response_time = int((time.time() - start_time) * 1000)
                response_text = result.text
                
                working_model = test_model
                print(f"  [OK] Model {test_model} works!")
                break
            except Exception as e:
                error_str = str(e).lower()
                if 'not found' in error_str or '404' in error_str or 'not supported' in error_str:
                    print(f"  [WARN] Model {test_model} not available, trying next...")
                    continue
                else:
                    raise
        
        if not working_model:
            return {
                'provider': 'Gemini',
                'success': False,
                'error': f'None of the attempted models are available: {", ".join(models_to_try)}',
            }
        
        print(f"  [OK] Response received in {response_time}ms")
        print(f"  Response: \"{response_text}\"")
        
        return {
            'provider': 'Gemini',
            'success': True,
            'details': {
                'model': working_model,
                'response': response_text,
                'response_time': f'{response_time}ms',
            },
        }
    except Exception as e:
        error_msg = str(e)
        print(f"  [ERROR] Error: {error_msg}")
        
        if 'API key not valid' in error_msg or 'API_KEY_INVALID' in error_msg:
            return {
                'provider': 'Gemini',
                'success': False,
                'error': 'Invalid API key. Please check your GEMINI_API_KEY',
            }
        
        return {
            'provider': 'Gemini',
            'success': False,
            'error': error_msg,
        }


def test_provider_priority():
    """Test AI Provider Priority configuration"""
    print('\n[CONFIG] Testing AI Provider Priority Configuration...')
    print('-' * 60)
    
    priority = os.getenv('AI_PROVIDER_PRIORITY', 'openai,gemini')
    providers = [p.strip() for p in priority.lower().split(',') if p.strip() in ['openai', 'gemini']]
    
    print(f"  AI_PROVIDER_PRIORITY: {priority}")
    print(f"  Parsed providers: {' -> '.join(providers) if providers else 'None'}")
    
    if not providers:
        print(f"  [WARN] Warning: No valid providers found. Defaulting to: openai,gemini")
    else:
        print(f"  [OK] Priority order: {' (primary) -> '.join(providers)} (fallback)")


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description='Test OpenAI and Gemini API keys',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        '--openai-key',
        type=str,
        help='OpenAI API key (or set OPENAI_API_KEY env var)'
    )
    
    parser.add_argument(
        '--gemini-key',
        type=str,
        help='Gemini API key (or set GEMINI_API_KEY env var)'
    )
    
    parser.add_argument(
        '--env-file',
        type=str,
        default='.env.local',
        help='Path to .env.local file (default: .env.local in current directory)'
    )
    
    args = parser.parse_args()
    
    # Load environment variables
    env_vars = {}
    env_path = Path(args.env_file)
    
    if env_path.exists():
        print(f"[OK] Loading environment from: {env_path}\n")
        env_vars = load_env_file(env_path)
        # Update os.environ with loaded vars
        for key, value in env_vars.items():
            os.environ[key] = value
    else:
        print(f"[WARN] {env_path} not found. Using system environment variables.\n")
    
    # Get API keys (command line args take precedence)
    openai_key = args.openai_key or os.getenv('OPENAI_API_KEY')
    gemini_key = args.gemini_key or os.getenv('GEMINI_API_KEY')
    
    print('=' * 60)
    print('         AI Provider Testing Script')
    print('         Testing OpenAI & Gemini API Keys')
    print('=' * 60)
    
    # Test provider priority configuration
    test_provider_priority()
    
    # Test both providers
    results = []
    
    if openai_key:
        openai_result = test_openai(openai_key)
        results.append(openai_result)
    else:
        print('\n[WARN] Skipping OpenAI test (no API key provided)')
        results.append({
            'provider': 'OpenAI',
            'success': False,
            'error': 'No API key provided',
        })
    
    if gemini_key:
        gemini_result = test_gemini(gemini_key)
        results.append(gemini_result)
    else:
        print('\n[WARN] Skipping Gemini test (no API key provided)')
        results.append({
            'provider': 'Gemini',
            'success': False,
            'error': 'No API key provided',
        })
    
    # Summary
    print('\n' + '=' * 60)
    print('                    Test Summary')
    print('=' * 60)
    
    for result in results:
        status = '[PASS]' if result['success'] else '[FAIL]'
        print(f'\n{status} - {result["provider"]}')
        if result['success'] and 'details' in result:
            details = result['details']
            print(f'   Model: {details.get("model", "N/A")}')
            print(f'   Response Time: {details.get("response_time", "N/A")}')
            if 'tokens_used' in details and details['tokens_used']:
                print(f'   Tokens Used: {details["tokens_used"]}')
        elif 'error' in result:
            print(f'   Error: {result["error"]}')
    
    all_passed = all(r['success'] for r in results)
    any_passed = any(r['success'] for r in results)
    
    print('\n' + '=' * 60)
    if all_passed:
        print('[SUCCESS] All AI providers are working correctly!')
        print('   Your configuration is ready to use.')
        sys.exit(0)
    elif any_passed:
        print('[PARTIAL] Some AI providers are working, but not all.')
        print('   The app will use available providers with fallback.')
        sys.exit(1)
    else:
        print('[FAIL] No AI providers are working.')
        print('   Please check your API keys.')
        sys.exit(2)


if __name__ == '__main__':
    main()

