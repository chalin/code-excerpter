# Plaster Defaults

Languages without a known comment wrapper keep the raw plaster string:

<?code-excerpt "plaster.txt"?>
```
abc
···
def
```

Known language defaults use language-shaped plaster templates:

<?code-excerpt "plaster.dart"?>
```dart
var greeting = 'hello';
// ···
var scope = 'world';
```

<?code-excerpt "plaster.css"?>
```css
.abc {}
/* ··· */
.def {}
```

<?code-excerpt "plaster.html"?>
```html
<p>
<!-- ··· -->
</p>
```

<?code-excerpt "plaster.yaml"?>
```yaml
abc:
# ···
  def
```

Custom templates override the default template:

<?code-excerpt "plaster.dart" plaster="/*...*/"?>
```dart
var greeting = 'hello';
/*...*/
var scope = 'world';
```

<?code-excerpt "plaster.dart" plaster="/* $defaultPlaster */"?>
```dart
var greeting = 'hello';
/* ··· */
var scope = 'world';
```

`plaster="none"` removes plaster lines:

<?code-excerpt "plaster.dart" plaster="none"?>
```dart
var greeting = 'hello';
var scope = 'world';
```
