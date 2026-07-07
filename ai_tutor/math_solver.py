import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
)

transformations = standard_transformations + (implicit_multiplication_application,)

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
        return parse_expr(cleaned, transformations=transformations)
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
