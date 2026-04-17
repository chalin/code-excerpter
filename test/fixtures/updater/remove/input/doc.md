## Test remove transform op

Plain string argument:

<?code-excerpt "basic.dart" remove="$greeting"?>
```dart
old
```

Regexp argument:

<?code-excerpt "basic.dart" remove="/^v/"?>
```dart
old
```

Plain string of the form `/.../`:

<?code-excerpt "indented_frag.dart" region="single-code-block" remove="\//"?>
```dart
old
```
