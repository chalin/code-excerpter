## Test remove transform op

Plain string argument:

<?code-excerpt "basic.dart" remove="$greeting"?>
```dart
var greeting = 'hello';
var scope = 'world';
```

Regexp argument:

<?code-excerpt "basic.dart" remove="/^v/"?>
```dart
```

Plain string of the form `/.../`:

<?code-excerpt "indented_frag.dart" region="single-code-block" remove="\//"?>
```dart
var x = 1;
return x;
```
