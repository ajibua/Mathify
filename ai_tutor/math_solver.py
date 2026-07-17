import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
)

transformations = standard_transformations + (implicit_multiplication_application,)

import re

def parse_math(expr_str):
    """
    Safely parse a mathematical expression string into a SymPy object.
    Strips simple LaTeX wrappers ($) or backslashes if standard.
    """
    try:
        cleaned = expr_str.strip().replace('$', '')
        cleaned = cleaned.replace('\\sin', 'sin')
        cleaned = cleaned.replace('\\cos', 'cos')
        cleaned = cleaned.replace('\\tan', 'tan')
        cleaned = cleaned.replace('\\log', 'log')
        cleaned = cleaned.replace('\\exp', 'exp')
        cleaned = cleaned.replace('\\pi', 'pi')
        cleaned = cleaned.replace('{', '(').replace('}', ')')
        cleaned = cleaned.replace('^', '**')

        # 1. Lexical validation (blacklist unsafe characters and words)
        if re.search(r'[^a-zA-Z0-9\s\+\-\*\/\^\(\)\.\,\!\=\<\>\_]', cleaned):
            raise ValueError("Expression contains invalid characters.")

        forbidden = ['import', 'eval', 'exec', 'lambda', 'class', 'def', 'os', 'sys', 'subprocess', 'builtin', '__']
        for word in forbidden:
            if word in cleaned:
                raise ValueError(f"Expression contains forbidden term: {word}")

        # 2. Strict evaluation context (disable builtins to prevent RCE)
        safe_globals = {
            '__builtins__': {},
        }
        # Add basic math symbols and functions from sympy
        for name in ['sin', 'cos', 'tan', 'log', 'exp', 'pi', 'Symbol', 'Integer', 'Float', 'Symbol']:
            if hasattr(sp, name):
                safe_globals[name] = getattr(sp, name)

        return parse_expr(cleaned, global_dict=safe_globals, transformations=transformations)
    except Exception as e:
        raise ValueError(f"Could not parse expression '{expr_str}': {str(e)}")

def solve_derivative(expr_str, var_str='x'):
    """
    Calculates the symbolic derivative of the expression.
    Returns a dictionary with success status, the LaTeX result, and plain string.
    """
    try:
        x = sp.Symbol(var_str)
        expr = parse_math(expr_str)
        result = sp.diff(expr, x)
        return {
            'success': True,
            'result_latex': sp.latex(result),
            'result_str': str(result)
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def solve_integral(expr_str, var_str='x'):
    """
    Calculates the symbolic indefinite integral of the expression.
    Returns a dictionary with success status, the LaTeX result, and plain string.
    """
    try:
        x = sp.Symbol(var_str)
        expr = parse_math(expr_str)
        result = sp.integrate(expr, x)
        return {
            'success': True,
            'result_latex': sp.latex(result),
            'result_str': str(result)
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def check_equivalence(expr_a_str, expr_b_str):
    """
    Determines if two mathematical expressions are equivalent (e.g. x(x+1) and x^2 + x).
    """
    try:
        expr_a = parse_math(expr_a_str)
        expr_b = parse_math(expr_b_str)
        diff = sp.simplify(expr_a - expr_b)
        return {
            'success': True,
            'equivalent': diff == 0,
            'simplified_difference': str(diff)
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}
