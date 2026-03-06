#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Provider Testing Script
Tests OpenAI, Gemini, Anthropic, and Perplexity API keys and shows where to check credit balance.

Usage:
    python test-ai-providers.py [--openai-key KEY] [--gemini-key KEY] [--anthropic-key KEY] [--perplexity-key KEY] [--env-file PATH]
    python test-ai-providers.py --help

Options:
    --openai-key KEY       OpenAI API key (or set OPENAI_API_KEY env var)
    --gemini-key KEY       Gemini API key (or set GEMINI_API_KEY env var)
    --anthropic-key KEY    Anthropic API key (or set ANTHROPIC_API_KEY env var)
    --perplexity-key KEY   Perplexity API key (or set PERPLEXITY_API_KEY env var)
    --env-file PATH        Path to .env.local file (default: .env.local in current dir)
    --help                 Show this help message

Examples:
    # Test with environment variables (e.g. from .env.local)
    python test-ai-providers.py

    # Test with explicit keys
    python test-ai-providers.py --anthropic-key sk-ant-... --perplexity-key pplx-...

    # Test with custom env file
    python test-ai-providers.py --env-file /path/to/.env.local
"""

import os
import sys
import argparse
import time
import json
import urllib.request
import urllib.error
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


def test_anthropic(api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    """Test Anthropic (Claude) API"""
    print('\n[ANTHROPIC] Testing Anthropic (Claude) API...')
    print('-' * 60)

    if not api_key:
        return {
            'provider': 'Anthropic',
            'success': False,
            'error': 'ANTHROPIC_API_KEY not provided',
        }

    clean_key = clean_api_key(api_key)
    if not clean_key.startswith('sk-ant-'):
        return {
            'provider': 'Anthropic',
            'success': False,
            'error': f'Invalid API key format. Expected to start with "sk-ant-", got: {clean_key[:12]}...',
        }

    test_model = model or os.getenv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022')
    print(f"  Model: {test_model}")
    print(f"  API Key: {clean_key[:12]}...{clean_key[-4:]}")

    try:
        body = json.dumps({
            'model': test_model,
            'max_tokens': 50,
            'messages': [
                {'role': 'user', 'content': 'Say "Anthropic API is working!" in one sentence.'},
            ],
        }).encode('utf-8')
        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=body,
            headers={
                'x-api-key': clean_key,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            method='POST',
        )
        start_time = time.time()
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        response_time = int((time.time() - start_time) * 1000)

        text = ''
        for block in data.get('content', []):
            if block.get('type') == 'text':
                text = block.get('text', '')
                break
        print(f"  [OK] Response received in {response_time}ms")
        print(f"  Response: \"{text}\"")

        usage = data.get('usage', {})
        if usage:
            print(f"  Tokens: input={usage.get('input_tokens', 'N/A')}, output={usage.get('output_tokens', 'N/A')}")

        return {
            'provider': 'Anthropic',
            'success': True,
            'details': {
                'model': test_model,
                'response': text,
                'response_time': f'{response_time}ms',
                'tokens_used': usage.get('input_tokens', 0) + usage.get('output_tokens', 0) if usage else None,
            },
        }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else str(e)
        if e.code == 401:
            return {'provider': 'Anthropic', 'success': False, 'error': 'Invalid API key. Check ANTHROPIC_API_KEY.'}
        if e.code == 429:
            return {'provider': 'Anthropic', 'success': False, 'error': 'Rate limit or out of credits. Check balance at console.anthropic.com'}
        return {'provider': 'Anthropic', 'success': False, 'error': f'HTTP {e.code}: {err_body[:200]}'}
    except Exception as e:
        error_msg = str(e)
        print(f"  [ERROR] {error_msg}")
        return {'provider': 'Anthropic', 'success': False, 'error': error_msg}


def test_perplexity(api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    """Test Perplexity API (used for web search in Vani)"""
    print('\n[PERPLEXITY] Testing Perplexity API...')
    print('-' * 60)

    if not api_key:
        return {
            'provider': 'Perplexity',
            'success': False,
            'error': 'PERPLEXITY_API_KEY not provided',
        }

    clean_key = clean_api_key(api_key)
    test_model = model or os.getenv('PERPLEXITY_MODEL', 'sonar')
    print(f"  Model: {test_model}")
    print(f"  API Key: {clean_key[:8]}...{clean_key[-4:]}")

    try:
        body = json.dumps({
            'model': test_model,
            'messages': [
                {'role': 'user', 'content': 'Reply in one short sentence: "Perplexity API is working!"'},
            ],
            'max_tokens': 50,
        }).encode('utf-8')
        req = urllib.request.Request(
            'https://api.perplexity.ai/chat/completions',
            data=body,
            headers={
                'Authorization': f'Bearer {clean_key}',
                'Content-Type': 'application/json',
            },
            method='POST',
        )
        start_time = time.time()
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        response_time = int((time.time() - start_time) * 1000)

        content = ''
        if data.get('choices'):
            content = (data['choices'][0].get('message') or {}).get('content', '') or ''
        print(f"  [OK] Response received in {response_time}ms")
        print(f"  Response: \"{content[:80]}\"")

        usage = data.get('usage', {})
        if usage:
            print(f"  Tokens: {usage.get('total_tokens', 'N/A')}")

        return {
            'provider': 'Perplexity',
            'success': True,
            'details': {
                'model': test_model,
                'response': content[:200],
                'response_time': f'{response_time}ms',
                'tokens_used': usage.get('total_tokens') if usage else None,
            },
        }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else str(e)
        if e.code == 401:
            return {'provider': 'Perplexity', 'success': False, 'error': 'Invalid API key. Check PERPLEXITY_API_KEY.'}
        if e.code == 402 or e.code == 429:
            return {'provider': 'Perplexity', 'success': False, 'error': 'Out of credits or rate limit. Check API Portal → Billing.'}
        return {'provider': 'Perplexity', 'success': False, 'error': f'HTTP {e.code}: {err_body[:200]}'}
    except Exception as e:
        error_msg = str(e)
        print(f"  [ERROR] {error_msg}")
        return {'provider': 'Perplexity', 'success': False, 'error': error_msg}


def test_provider_priority():
    """Test LLM_PROVIDER configuration (used by Vani for fallback order)"""
    print('\n[CONFIG] LLM_PROVIDER (fallback order)...')
    print('-' * 60)

    priority = os.getenv('LLM_PROVIDER', 'anthropic,openai,gemini')
    allowed = {'anthropic', 'openai', 'gemini', 'perplexity'}
    providers = [p.strip().lower() for p in priority.split(',') if p.strip().lower() in allowed]
    providers = list(dict.fromkeys(providers))  # preserve order, dedupe

    print(f"  LLM_PROVIDER: {priority}")
    print(f"  Parsed (LLM): {' -> '.join(providers) if providers else 'None'}")

    if not providers:
        print(f"  [WARN] No valid LLM providers in list. App will default to anthropic.")
    else:
        print(f"  [OK] First = primary, rest = fallback when primary fails.")


def print_balance_help(results: list):
    """Print where to check credit balance for each provider"""
    print('\n' + '=' * 60)
    print('           Credit balance & usage (check dashboards)')
    print('=' * 60)
    print('  Balance is not returned by these APIs; use the links below.\n')
    providers_info = [
        ('Anthropic', 'https://console.anthropic.com', 'Usage & billing → Settings'),
        ('OpenAI',    'https://platform.openai.com/account/usage', 'Usage → Account usage'),
        ('Gemini',    'https://aistudio.google.com', 'Google AI Studio or Cloud Console billing'),
        ('Perplexity', 'https://www.perplexity.ai/settings/api', 'API → Billing / Usage metrics'),
    ]
    for name, url, where in providers_info:
        has_key = any(
            r.get('provider') == name and (r.get('error') or '').lower() != 'no api key provided'
            for r in results
        )
        key_status = ' (key set)' if has_key else ''
        print(f'  {name}{key_status}')
        print(f'    {url}')
        print(f'    → {where}')
        print()
    print('  Tip: Set ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, etc. in .env.local and run this script to verify.')


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description='Test OpenAI, Gemini, Anthropic, and Perplexity API keys',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument('--openai-key', type=str, help='OpenAI API key (or set OPENAI_API_KEY env var)')
    parser.add_argument('--gemini-key', type=str, help='Gemini API key (or set GEMINI_API_KEY env var)')
    parser.add_argument('--anthropic-key', type=str, help='Anthropic API key (or set ANTHROPIC_API_KEY env var)')
    parser.add_argument('--perplexity-key', type=str, help='Perplexity API key (or set PERPLEXITY_API_KEY env var)')
    parser.add_argument(
        '--env-file',
        type=str,
        default='.env.local',
        help='Path to .env.local file (default: .env.local in current directory)',
    )

    args = parser.parse_args()

    env_path = Path(args.env_file)
    if env_path.exists():
        print(f"[OK] Loading environment from: {env_path}\n")
        for key, value in load_env_file(env_path).items():
            os.environ[key] = value
    else:
        print(f"[WARN] {env_path} not found. Using system environment variables.\n")

    openai_key = args.openai_key or os.getenv('OPENAI_API_KEY')
    gemini_key = args.gemini_key or os.getenv('GEMINI_API_KEY')
    anthropic_key = args.anthropic_key or os.getenv('ANTHROPIC_API_KEY')
    perplexity_key = args.perplexity_key or os.getenv('PERPLEXITY_API_KEY')

    print('=' * 60)
    print('         AI Provider Testing Script')
    print('         OpenAI · Gemini · Anthropic · Perplexity')
    print('=' * 60)

    test_provider_priority()

    results = []

    for label, key, test_fn in [
        ('OpenAI', openai_key, test_openai),
        ('Gemini', gemini_key, test_gemini),
        ('Anthropic', anthropic_key, test_anthropic),
        ('Perplexity', perplexity_key, test_perplexity),
    ]:
        if key:
            results.append(test_fn(key))
        else:
            print(f'\n[WARN] Skipping {label} test (no API key provided)')
            results.append({'provider': label, 'success': False, 'error': 'No API key provided'})

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
            if details.get('tokens_used'):
                print(f'   Tokens Used: {details["tokens_used"]}')
        elif result.get('error'):
            print(f'   Error: {result["error"]}')

    print_balance_help(results)

    all_passed = all(r['success'] for r in results)
    any_passed = any(r['success'] for r in results)

    print('=' * 60)
    if all_passed:
        print('[SUCCESS] All configured AI providers are working.')
        sys.exit(0)
    elif any_passed:
        print('[PARTIAL] Some providers work; app will use them with fallback.')
        sys.exit(1)
    else:
        print('[FAIL] No AI providers working. Check API keys and balance.')
        sys.exit(2)


if __name__ == '__main__':
    main()

